// scripts/max-worker.ts — 관리자 PC 에서 상주하는 생성 워커. studio_jobs(pending) 를 집어 `claude -p`(Max 구독)로 만들고
// 결과를 실시간으로 result 에 써 넣는다. 서버 쪽 스위치: Vercel 환경변수 MAX_WORKER=1 (관리자 계정만 이 경로).
// 실행: npm run max-worker   (.env.local 의 SUPABASE_SERVICE_ROLE_KEY 사용, claude CLI 로그인 상태 필요)
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { parseGeneration, extractTitle } from '../lib/studio/parse'
import { smokeGame } from './smoke-game.mjs'
import { hardenHtml } from '../lib/studio/harden'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
// 모델 — 스튜디오에서 관리자가 고른 엔진(Opus 5 / Fable 5.1)이 job.model 로 온다. MAX_WORKER_MODEL 이 있으면 그것으로 강제
const FORCE_MODEL = process.env.MAX_WORKER_MODEL || ''
const cliModel = (m: string | null) => FORCE_MODEL || (/^claude-/.test(m ?? '') ? m! : /opus/i.test(m ?? '') ? 'opus' : /haiku/i.test(m ?? '') ? 'haiku' : 'sonnet')
// Max 구독 사용량(5시간·7일 창) — CLI 의 rate_limit_event 를 받아 site_settings 에 저장(스튜디오 엔진 선택기에 표시)
async function saveUsage(info: Record<string, unknown>, model: string, lastError: string | null) {
  try { await sb.from('site_settings').upsert({ key: 'max_usage', value: { ...info, model, lastError, at: new Date().toISOString() }, updated_at: new Date().toISOString() } as never) } catch { /* noop */ }
}
// claude CLI 가 .env.local 의 ANTHROPIC_API_KEY(크레딧 소진)를 쓰지 않고 claude.ai(Max) 로그인으로 돌도록 키를 뺀 환경
const cliEnv = (() => { const e: NodeJS.ProcessEnv = { ...process.env, CLAUDECODE: '' }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e })()

type Msg = { role: string; content: string | { type: string; text?: string; source?: { media_type?: string; data?: string } }[] }
// 이미지 블록은 임시 파일로 저장하고 경로를 알려 준다 — claude CLI 가 Read 도구로 열어 본다
function flatten(messages: Msg[], tmpDir: string): { text: string; files: string[] } {
  const files: string[] = []
  const text = messages.map(m => {
    const body = typeof m.content === 'string' ? m.content : m.content.map(c => {
      if (c.type === 'text') return c.text ?? ''
      if (c.type === 'image' && c.source?.data) {
        const ext = (c.source.media_type ?? 'image/png').split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
        const f = `${tmpDir}/img-${files.length + 1}.${ext}`
        fs.writeFileSync(f, Buffer.from(c.source.data, 'base64')); files.push(f)
        return `[첨부 이미지 ${files.length}: ${f} — Read 도구로 이 파일을 열어 내용을 확인한 뒤 요청에 반영할 것]`
      }
      return ''
    }).join('\n')
    return `${m.role === 'assistant' ? '[ASSISTANT]' : '[USER]'}\n${body}`
  }).join('\n\n') + '\n\n[ASSISTANT]\n'
  return { text, files }
}

async function runJob(job: { id: string; model: string | null; system: string; messages: Msg[] }) {
  console.log(new Date().toISOString(), 'job', job.id.slice(0, 8), 'model', cliModel(job.model))
  await sb.from('studio_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)
  let buf = '', dirty = false, lastFlush = 0
  const flush = async (force = false) => { if (!dirty && !force) return; if (!force && Date.now() - lastFlush < 400) return; dirty = false; lastFlush = Date.now(); await sb.from('studio_jobs').update({ result: buf }).eq('id', job.id) }
  const tmpDir = fs.mkdtempSync('/tmp/vbx-job-')
  const { text: input, files } = flatten(job.messages, tmpDir)
  // 이미지가 있으면 Read 도구만 허용(파일을 보기 위해), 없으면 도구 없이
  const args = ['-p', '--tools', files.length ? 'Read' : '', '--model', cliModel(job.model), '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence', '--effort', 'medium', '--system-prompt', job.system, ...(files.length ? ['--add-dir', tmpDir] : [])]
  const child = spawn('claude', args, { env: cliEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdin.write(input); child.stdin.end()
  let rest = '', err = '', apiError: string | null = null
  child.stdout.on('data', (d: Buffer) => {
    rest += d.toString('utf8'); const lines = rest.split('\n'); rest = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string; subtype?: string; rate_limit_info?: Record<string, unknown>; api_error?: string; error?: string }
        if (ev.type === 'rate_limit_event' && ev.rate_limit_info) void saveUsage(ev.rate_limit_info, cliModel(job.model), null)
        if (ev.type === 'assistant' && ev.api_error) apiError = ev.api_error
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { buf += ev.event.delta.text ?? ''; dirty = true }
        else if (ev.type === 'result' && typeof ev.result === 'string' && !buf) { buf = ev.result; dirty = true }
      } catch { /* 비 JSON 줄 무시 */ }
    }
    void flush()
  })
  child.stderr.on('data', (d: Buffer) => { err += d.toString('utf8') })
  // 사용자가 취소하면(서버가 status=cancelled) CLI 를 끊는다
  let cancelled = false
  const watch = setInterval(async () => { const { data } = await sb.from('studio_jobs').select('status').eq('id', job.id).single(); if ((data as { status: string } | null)?.status === 'cancelled') { cancelled = true; clearInterval(watch); try { child.kill('SIGTERM') } catch { /* noop */ } } }, 1500)
  const code: number = await new Promise(res => child.on('close', res))
  clearInterval(watch)
  if (cancelled) { console.log('  cancelled'); try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* noop */ } return }
  await flush(true)
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* noop */ }
  // Max 구독 한도·추가 사용량 소진(예: Fable 5.1 은 추가 사용량 필요) — 알기 쉬운 오류로
  if (apiError && buf.length < 400) {
    const msg = apiError === 'model_requires_usage_credits' ? `${cliModel(job.model)} 은(는) Max 추가 사용량이 필요한데 소진됐어요 — 엔진을 Opus 5 로 바꾸거나 초기화 후 다시 시도하세요` : apiError === 'rate_limit' ? 'Max 구독 사용량 한도에 걸렸어요 — 초기화 시간 이후 다시 시도하거나 API 토큰 엔진을 쓰세요' : `Max 오류: ${apiError}`
    await sb.from('studio_jobs').update({ status: 'error', error: msg, finished_at: new Date().toISOString() }).eq('id', job.id)
    void sb.from('site_settings').select('value').eq('key', 'max_usage').maybeSingle().then(({ data }) => { const v = (data as { value?: Record<string, unknown> } | null)?.value; if (v) void saveUsage(v, cliModel(job.model), msg) })
    console.log('  api error', apiError); try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* noop */ } return
  }
  // CLI 가 인증·크레딧 오류를 '결과 텍스트'로 돌려주면 게임 코드로 저장하지 말고 오류로 — 서버가 API 폴백/안내
  if (buf.length < 300 && /credit balance is too low|invalid api key|not logged in|please run \/login|authentication/i.test(buf)) { await sb.from('studio_jobs').update({ status: 'error', error: buf.slice(0, 500), finished_at: new Date().toISOString() }).eq('id', job.id); console.log('  auth/credit error', buf); return }
  if (code !== 0 && !buf) { await sb.from('studio_jobs').update({ status: 'error', error: err.slice(0, 500) || `exit ${code}`, finished_at: new Date().toISOString() }).eq('id', job.id); console.log('  error', err.slice(0, 200)); return }
  // ── 실제로 실행해 본다 → 실패하면 오류를 넣어 자동 수정(최대 2회) ──
  buf = await testAndRepair(job, buf, (t) => { buf += t; dirty = true; void flush() })
  await sb.from('studio_jobs').update({ status: 'done', result: buf, finished_at: new Date().toISOString() }).eq('id', job.id)
  console.log('  done', buf.length, 'chars')
  void ensureSaved(job, buf)
}

// CLI 한 번 실행 — 수정 라운드용(도구 없이, 텍스트만 받는다)
function runClaudeOnce(system: string, model: string, input: string, onText: (t: string) => void): Promise<string> {
  return new Promise((resolve) => {
    let out = '', rest = ''
    const child = spawn('claude', ['-p', '--tools', '', '--model', model, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence', '--effort', 'medium', '--system-prompt', system], { env: cliEnv, stdio: ['pipe', 'pipe', 'pipe'] })
    child.stdin.write(input); child.stdin.end()
    child.stdout.on('data', (d: Buffer) => {
      rest += d.toString('utf8'); const lines = rest.split('\n'); rest = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const ev = JSON.parse(line) as { type?: string; event?: { type?: string; delta?: { type?: string; text?: string } }; result?: string }
          if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') { const t = ev.event.delta.text ?? ''; out += t; onText(t) }
          else if (ev.type === 'result' && typeof ev.result === 'string' && !out) { out = ev.result; onText(ev.result) }
        } catch { /* 비 JSON 줄 무시 */ }
      }
    })
    child.on('close', () => resolve(out))
  })
}

// 생성된 게임을 헤드리스 크롬에서 실제로 띄워 보고, 안 돌아가면 오류를 알려 주고 고치게 한다.
// 고친 완성본은 결과 뒤에 이어 붙이고(파서가 '마지막 게임 블록'을 쓴다), 끝에 테스트 결과 한 줄을 남긴다.
async function testAndRepair(job: { id: string; model: string | null; system: string }, buf: string, append: (t: string) => void): Promise<string> {
  let out = buf
  for (let round = 0; round <= 2; round++) {
    const html = parseGeneration(out).html
    if (!html) return out                       // 게임이 없으면 테스트할 것도 없다
    let r
    try { r = await smokeGame(html) } catch (e) { console.log('  실행 테스트 불가', e); return out }
    console.log(`  실행 테스트 ${round + 1}회: ${r.ok ? '통과' : '실패'} (frames ${r.ticks}${r.errors.length ? ', ' + r.errors[0] : ''})`)
    if (r.ok) {
      const note = `✅ 브라우저에서 실제로 실행해 확인했어요${r.warnings.length ? ` (참고: ${r.warnings[0]})` : ''}.`
      const tail = `\n[[VBX_TEST]]${note}[[/VBX_TEST]]`
      append(tail); return out + tail
    }
    if (round === 2) {
      const tail = `\n[[VBX_TEST]]⚠ 실행 테스트에서 아직 문제가 남아 있어요: ${r.errors.slice(0, 2).join(' / ')} — 한 번 더 고쳐 달라고 말씀해 주세요.[[/VBX_TEST]]`
      append(tail); return out + tail
    }
    // 고치기 — 오류를 그대로 알려 주고 전체 완성본을 다시 받는다
    const fixPrompt = `[USER]\n아래 게임을 실제 브라우저(헤드리스 크롬)에서 실행해 봤더니 이런 문제가 났다:\n${r.errors.map(e => '- ' + e).join('\n')}${r.warnings.length ? '\n(주의)\n' + r.warnings.map(w => '- ' + w).join('\n') : ''}\n\n원인을 찾아 고친 "전체 완성본" HTML 을 <game>…</game> 으로 다시 출력해라. 설명은 무엇을 고쳤는지 1~2문장만. 다른 기능은 그대로 유지할 것.\n\n<game>${html}</game>\n\n[ASSISTANT]\n`
    console.log('  → 자동 수정 요청')
    const fixed = await runClaudeOnce(job.system, cliModel(job.model), fixPrompt, () => { /* 수정 과정은 화면에 흘리지 않는다 */ })
    if (!parseGeneration(fixed).html) {
      const tail = `\n[[VBX_TEST]]⚠ 실행 테스트 실패: ${r.errors[0]} (자동 수정도 실패했어요)[[/VBX_TEST]]`
      append(tail); return out + tail
    }
    const add = `\n\n${fixed}`
    append(add); out += add
  }
  return out
}

// ── 저장 안전장치 ──
// 생성이 3~4분 걸리면 서버(Vercel) 함수가 먼저 끊겨 버전이 저장되지 않는 일이 있었다(화면엔 답변이 보이지만 새로고침하면 사라짐).
// 서버가 저장할 시간을 준 뒤에도 새 버전이 없으면 워커가 직접 저장한다.
async function ensureSaved(job: { id: string; project_id?: string; messages: Msg[] }, result: string) {
  try {
    await new Promise(r => setTimeout(r, 20_000))
    const { data: jobRow } = await sb.from('studio_jobs').select('project_id,created_at').eq('id', job.id).maybeSingle()
    const row = jobRow as { project_id: string; created_at: string } | null
    if (!row?.project_id) return
    const parsed = parseGeneration(result)
    if (!parsed.html) return
    const { data: after } = await sb.from('studio_versions').select('id').eq('project_id', row.project_id).gt('created_at', row.created_at).limit(1)
    if ((after ?? []).length) return   // 서버가 이미 저장함
    const { data: last } = await sb.from('studio_versions').select('version').eq('project_id', row.project_id).order('version', { ascending: false }).limit(1).maybeSingle()
    const next = ((last as { version?: number } | null)?.version ?? 0) + 1
    const { error: vErr } = await sb.from('studio_versions').insert([{ project_id: row.project_id, version: next, html: hardenHtml(parsed.html) }] as never)
    if (vErr) { console.log('  [저장 안전장치] 버전 저장 실패', vErr.message); return }
    const lastUser = [...job.messages].reverse().find(m => m.role !== 'assistant')
    const prompt = typeof lastUser?.content === 'string' ? lastUser.content : (lastUser?.content ?? []).map(c => c.text ?? '').join('\n')
    await sb.from('studio_messages').insert([
      { project_id: row.project_id, role: 'user', content: (prompt || '(요청)').slice(0, 4000) },
      { project_id: row.project_id, role: 'assistant', content: parsed.description },
    ] as never)
    if (next === 1) { const t = extractTitle(parsed.html); if (t) await sb.from('studio_projects').update({ title: t } as never).eq('id', row.project_id) }
    console.log('  [저장 안전장치] 서버가 저장하지 못해 워커가 v' + next + ' 저장함')
  } catch (e) { console.log('  [저장 안전장치] 실패', e) }
}

console.log(`max-worker: 대기 중 (모델 ${FORCE_MODEL || '스튜디오 선택값'}, Max 로그인 사용 · Ctrl+C 로 종료)`)
for (;;) {
  try {
    const { data } = await sb.from('studio_jobs').select('id,model,system,messages').eq('status', 'pending').order('created_at').limit(1)
    const job = (data ?? [])[0] as { id: string; model: string | null; system: string; messages: Msg[] } | undefined
    if (job) await runJob(job)
  } catch (e) { console.error('worker loop', e) }
  await new Promise(r => setTimeout(r, 700))
}
