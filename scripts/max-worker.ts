// scripts/max-worker.ts — 관리자 PC 에서 상주하는 생성 워커. studio_jobs(pending) 를 집어 `claude -p`(Max 구독)로 만들고
// 결과를 실시간으로 result 에 써 넣는다. 서버 쪽 스위치: Vercel 환경변수 MAX_WORKER=1 (관리자 계정만 이 경로).
// 실행: npm run max-worker   (.env.local 의 SUPABASE_SERVICE_ROLE_KEY 사용, claude CLI 로그인 상태 필요)
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const cliModel = (m: string | null) => /opus/i.test(m ?? '') ? 'opus' : /haiku/i.test(m ?? '') ? 'haiku' : 'sonnet'

type Msg = { role: string; content: string | { type: string; text?: string }[] }
function flatten(messages: Msg[]): string {
  return messages.map(m => {
    const text = typeof m.content === 'string' ? m.content : m.content.map(c => c.type === 'text' ? (c.text ?? '') : '[image]').join('\n')
    return `${m.role === 'assistant' ? '[ASSISTANT]' : '[USER]'}\n${text}`
  }).join('\n\n') + '\n\n[ASSISTANT]\n'
}

async function runJob(job: { id: string; model: string | null; system: string; messages: Msg[] }) {
  console.log(new Date().toISOString(), 'job', job.id.slice(0, 8), 'model', cliModel(job.model))
  await sb.from('studio_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)
  let buf = '', dirty = false, lastFlush = 0
  const flush = async (force = false) => { if (!dirty && !force) return; if (!force && Date.now() - lastFlush < 800) return; dirty = false; lastFlush = Date.now(); await sb.from('studio_jobs').update({ result: buf }).eq('id', job.id) }
  const args = ['-p', '--tools', '', '--model', cliModel(job.model), '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence', '--effort', 'medium', '--system-prompt', job.system]
  const child = spawn('claude', args, { env: { ...process.env, CLAUDECODE: '' }, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdin.write(flatten(job.messages)); child.stdin.end()
  let rest = '', err = ''
  child.stdout.on('data', (d: Buffer) => {
    rest += d.toString('utf8'); const lines = rest.split('\n'); rest = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string; subtype?: string }
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { buf += ev.event.delta.text ?? ''; dirty = true }
        else if (ev.type === 'result' && typeof ev.result === 'string' && !buf) { buf = ev.result; dirty = true }
      } catch { /* 비 JSON 줄 무시 */ }
    }
    void flush()
  })
  child.stderr.on('data', (d: Buffer) => { err += d.toString('utf8') })
  const code: number = await new Promise(res => child.on('close', res))
  await flush(true)
  if (code !== 0 && !buf) { await sb.from('studio_jobs').update({ status: 'error', error: err.slice(0, 500) || `exit ${code}`, finished_at: new Date().toISOString() }).eq('id', job.id); console.log('  error', err.slice(0, 200)); return }
  await sb.from('studio_jobs').update({ status: 'done', result: buf, finished_at: new Date().toISOString() }).eq('id', job.id)
  console.log('  done', buf.length, 'chars')
}

console.log('max-worker: 대기 중 (Ctrl+C 로 종료)')
for (;;) {
  try {
    const { data } = await sb.from('studio_jobs').select('id,model,system,messages').eq('status', 'pending').order('created_at').limit(1)
    const job = (data ?? [])[0] as { id: string; model: string | null; system: string; messages: Msg[] } | undefined
    if (job) await runJob(job)
  } catch (e) { console.error('worker loop', e) }
  await new Promise(r => setTimeout(r, 1500))
}
