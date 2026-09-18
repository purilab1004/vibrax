// lib/studio/max-job.ts — 관리자 생성 요청을 API 크레딧 대신 "로컬 Claude Code(Max 구독)" 워커로 보내는 작업 큐.
// 서버(Vercel)는 claude CLI 를 실행할 수 없으므로 studio_jobs 에 작업을 넣고, 관리자 PC 에서 돌아가는
// scripts/max-worker.ts 가 집어가 `claude -p` 로 생성해 result 에 실시간으로 써 넣는다. 서버는 그걸 폴링해 스트림처럼 흘려준다.
// 워커가 25초 안에 집어가지 않으면 null 을 돌려 호출부가 API 로 폴백한다.
import type { SupabaseClient } from '@supabase/supabase-js'

export type MsgStream = AsyncIterable<{ type: string; delta?: { type: string; text?: string } }> & {
  finalMessage(): Promise<{ usage?: { input_tokens?: number; output_tokens?: number } }>
  abort?: () => void   // 사용자가 취소하면 호출 — 모델/워커 중단
  jobId?: string       // Max 워커 작업 id (백그라운드로 이어질 때 클라이언트가 기다릴 대상)
  pending?: boolean    // 서버 함수 시간이 다 됐지만 워커는 계속 만들고 있는 상태
}
// 서버(Vercel) 함수는 300초에서 끊긴다. 그 전에 스트림만 끝내고(=pending) 워커는 계속 만들게 둔다 —
// 완성되면 워커가 직접 버전을 저장하고, 화면은 그걸 받아 자동으로 갱신한다(몇 분이 걸려도 무방).
const PICKUP_MS = 25_000, SOFT_MS = 225_000, POLL_MS = 500
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
  if (!picked) {
    // 워커가 살아 있는데 다른 작업 중이라 아직 못 집은 것이라면 — API 로 넘기지 않고 대기열에 둔다.
    // (예전엔 여기서 API 폴백 → API 키 크레딧 부족 오류가 '크레딧이 부족합니다' 로 보였다)
    const { data: beat } = await admin.from('site_settings').select('value').eq('key', 'max_worker').maybeSingle()
    const at = (beat as { value?: { at?: string } } | null)?.value?.at
    const alive = !!at && Date.now() - new Date(at).getTime() < 60_000
    if (alive) {
      console.log('[max-job] 워커가 바쁨 — 대기열에 두고 백그라운드로 진행', id)
      const queued: MsgStream = {
        jobId: id, pending: true,
        // eslint-disable-next-line require-yield
        async *[Symbol.asyncIterator]() { return },
        async finalMessage() { return { usage: { input_tokens: 0, output_tokens: 0 } } },
        abort() { void admin.from('studio_jobs').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', id).in('status', ['pending', 'running']) },
      }
      return queued
    }
    await admin.from('studio_jobs').update({ status: 'abandoned', error: 'no worker', finished_at: new Date().toISOString() }).eq('id', id)
    return null
  }
  let sent = 0, ended = false
  const stream: MsgStream = {
    jobId: id,
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
        if (Date.now() - start > SOFT_MS) { ended = true; stream.pending = true; console.log('[max-job] 서버 시간 한계 — 워커는 계속 진행', id); break }
      }
    },
    async finalMessage() { return { usage: { input_tokens: 0, output_tokens: 0 } } },
    abort() { ended = true; void admin.from('studio_jobs').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', id).in('status', ['pending', 'running']) },
  }
  return stream
}
