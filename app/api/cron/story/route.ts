// app/api/cron/story/route.ts — STORY 연재 스윕 (Vercel Cron, 매일 19:00 UTC = 04:00 KST)
// 모든 게임을 돌며: 서빙 버전이 바뀐 게임은 새 지도·몬스터 감지 → 다음 화, 계획해 둔 회차가 남은 게임은 한 화 연재.
// 스크립트로 버전을 밀어 넣어 /api/story/sync 가 불리지 않은 경우도 여기서 잡힌다.
// 인증: Vercel Cron 의 Authorization: Bearer ${CRON_SECRET} 또는 관리자 세션.
import { requireAdmin } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAutomation, logAutomation } from '@/lib/automation'
import { syncSeries, apiLlm, type SyncResult } from '@/lib/story/server'
import { logServerError } from '@/lib/log/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const fromCron = !!secret && (req.headers.get('authorization') ?? '') === `Bearer ${secret}`
  if (!fromCron) { const g = await requireAdmin(); if ('error' in g) return g.error }
  const sb = createAdminClient()
  const published = (await loadAutomation())['blog.autoPost']
  const { data } = await sb.from('games').select('id').order('created_at', { ascending: true })
  const results: SyncResult[] = []
  const started = Date.now()
  for (const { id } of (data ?? []) as { id: string }[]) {
    if (Date.now() - started > 240_000) { results.push({ gameId: id, action: 'skipped', detail: 'time budget' }); continue }
    try {
      const r = await syncSeries(sb, apiLlm, id, { published, releasePending: true })
      results.push(r)
      if (r.episode) void logAutomation({ module: 'blog', action: `STORY 연재(${r.action})`, target: id, status: published ? 'ok' : 'needs_review', detail: { ...r } })
    } catch (e) {
      results.push({ gameId: id, action: 'skipped', detail: (e as Error).message })
      void logServerError('api', e, { path: '/api/cron/story', meta: { gameId: id } })
    }
  }
  return Response.json({ ok: true, results: results.filter(r => r.action !== 'unchanged') })
}
