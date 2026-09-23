// app/api/cron/aj-design/route.ts — AJ 자율 게임 튜닝 스윕 (Vercel Cron, 매일 18:00 UTC = 03:00 KST)
// 진행 중 카나리 실험을 전부 평가하고, automation aj.autoDesign 이 on 이면 opt-in 게임에서 새 실험을 최대 3개 시작한다.
// 인증: Vercel Cron 의 Authorization: Bearer ${CRON_SECRET} 또는 관리자 세션.
import { requireAdmin } from '@/lib/admin/guard'
import { runDesignSweep } from '@/lib/aj/designer'
import { logServerError } from '@/lib/log/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  const fromCron = !!secret && auth === `Bearer ${secret}`
  if (!fromCron) { const g = await requireAdmin(); if ('error' in g) return g.error }
  try {
    const out = await runDesignSweep({ maxNew: 3 })
    const summary = {
      evaluated: out.evaluated.map(r => (r.kind === 'evaluated' ? { game: r.experiment.game_id, verdict: r.verdict, reason: r.reason } : r)),
      started: out.started.map(r => (r.kind === 'started' ? { game: r.experiment.game_id, hypothesis: r.experiment.hypothesis?.title } : r)),
      skipped: out.skipped,
    }
    return Response.json({ ok: true, ...summary })
  } catch (e) {
    void logServerError('api', e, { path: '/api/cron/aj-design' })
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'sweep failed' }, { status: 500 })
  }
}
