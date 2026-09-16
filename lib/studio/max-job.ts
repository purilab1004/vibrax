// lib/studio/max-job.ts — 관리자 생성 요청을 API 크레딧 대신 "로컬 Claude Code(Max 구독)" 워커로 보내는 작업 큐.
// 서버(Vercel)는 claude CLI 를 실행할 수 없으므로 studio_jobs 에 작업을 넣고, 관리자 PC 에서 돌아가는
// scripts/max-worker.ts 가 집어가 `claude -p` 로 생성해 result 에 실시간으로 써 넣는다. 서버는 그걸 폴링해 스트림처럼 흘려준다.
// 워커가 25초 안에 집어가지 않으면 null 을 돌려 호출부가 API 로 폴백한다.
import type { SupabaseClient } from '@supabase/supabase-js'

export type MsgStream = AsyncIterable<{ type: string; delta?: { type: string; text?: string } }> & {
  finalMessage(): Promise<{ usage?: { input_tokens?: number; output_tokens?: number } }>
}
const PICKUP_MS = 25_000, TOTAL_MS = 280_000, POLL_MS = 500
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function tryMaxJob(admin: SupabaseClient, job: { projectId: string; userId: string; model: string; system: string; messages: unknown }): Promise<MsgStream | null> {
  const { data, error } = await admin.from('studio_jobs').insert([{ project_id: job.projectId, user_id: job.userId, model: job.model, system: job.system, messages: job.messages, status: 'pending' }]).select('id').single()
  if (error || !data) { console.error('[max-job] insert failed', error?.message); return null }
  const id = (data as { id: string }).id
  // 워커가 집어가는지 확인
  const t0 = Date.now(); let picked = false
  while (Date.now() - t0 < PICKUP_MS) {
    await sleep(400)
    const { data: row } = await admin.from('studio_jobs').select('status').eq('id', id).maybeSingle()
    const st = (row as { status?: string } | null)?.status
    if (st && st !== 'pending') { picked = true; break }
  }
  if (!picked) { await admin.from('studio_jobs').update({ status: 'abandoned', error: 'no worker', finished_at: new Date().toISOString() }).eq('id', id); return null }
  let sent = 0, ended = false
  const stream: MsgStream = {
    async *[Symbol.asyncIterator]() {
      const start = Date.now()
      while (!ended) {
        await sleep(POLL_MS)
        const { data: row } = await admin.from('studio_jobs').select('status,result,error').eq('id', id).maybeSingle()
        const r = row as { status: string; result: string | null; error: string | null } | null
        const text = r?.result ?? ''
        if (text.length > sent) { const d = text.slice(sent); sent = text.length; yield { type: 'content_block_delta', delta: { type: 'text_delta', text: d } } }
        if (r?.status === 'done') { ended = true; break }
        if (r?.status === 'error') { ended = true; throw new Error(`max worker: ${r.error ?? 'failed'}`) }
        if (Date.now() - start > TOTAL_MS) { ended = true; await admin.from('studio_jobs').update({ status: 'timeout', finished_at: new Date().toISOString() }).eq('id', id); throw new Error('max worker timeout') }
      }
    },
    async finalMessage() { return { usage: { input_tokens: 0, output_tokens: 0 } } },
  }
  return stream
}
