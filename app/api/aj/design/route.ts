// app/api/aj/design/route.ts — 크리에이터용 AJ 자율 튜닝 제어
// GET  ?gameId=  → { enabled, running, experiments[], settings, ready }
// POST { gameId, action: 'toggle'|'run'|'veto'|'rollback', enabled? }  (게임 소유자 또는 관리자)
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'
import { runDesignCycle, vetoExperiment, rollbackLastAdopted, loadDesignSettings, designReady, type Experiment } from '@/lib/aj/designer'
import { isAuto } from '@/lib/automation'

export const runtime = 'nodejs'
export const maxDuration = 300

async function authz(gameId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: 'unauthorized' }, { status: 401 }) } as const
  const admin = createAdminClient()
  const [{ data: game }, { data: prof }] = await Promise.all([
    admin.from('games').select('id,user_id,studio_project_id').eq('id', gameId).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  const g = game as { id: string; user_id: string; studio_project_id: string | null } | null
  if (!g) return { error: Response.json({ error: 'not found' }, { status: 404 }) } as const
  const isAdmin = (prof as { role?: string } | null)?.role === 'admin'
  if (g.user_id !== user.id && !isAdmin) return { error: Response.json({ error: 'forbidden' }, { status: 403 }) } as const
  return { user, admin, game: g, isAdmin } as const
}

export async function GET(req: Request) {
  const gameId = new URL(req.url).searchParams.get('gameId') ?? ''
  if (!gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const a = await authz(gameId); if ('error' in a) return a.error
  const ready = await designReady(a.admin)
  if (!ready) return Response.json({ ready: false, enabled: false, running: null, experiments: [], settings: await loadDesignSettings(), automation: await isAuto('aj.autoDesign') })
  const [{ data: g }, { data: exps }] = await Promise.all([
    a.admin.from('games').select('auto_design,live_version_id,canary_version_id,canary_ratio').eq('id', gameId).maybeSingle(),
    a.admin.from('aj_experiments').select('*').eq('game_id', gameId).order('created_at', { ascending: false }).limit(12),
  ])
  const list = (exps ?? []) as Experiment[]
  const gg = g as { auto_design: boolean; live_version_id: string | null; canary_version_id: string | null; canary_ratio: number } | null
  return Response.json({ ready: true, enabled: !!gg?.auto_design, canaryRatio: gg?.canary_ratio ?? 0.2, running: list.find(e => e.status === 'canary') ?? null, experiments: list, settings: await loadDesignSettings(), automation: await isAuto('aj.autoDesign'), external: !a.game.studio_project_id })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { gameId?: string; action?: string; enabled?: boolean } | null
  const gameId = body?.gameId ?? ''
  if (!gameId || !body?.action) return Response.json({ error: 'bad request' }, { status: 400 })
  const a = await authz(gameId); if ('error' in a) return a.error
  if (!(await designReady(a.admin))) return Response.json({ error: 'not ready — db/migrations/2026-09-09-aj-design.sql 을 실행하세요' }, { status: 503 })
  if (!a.game.studio_project_id) return Response.json({ error: '외부 링크 게임은 코드를 수정할 수 없어요' }, { status: 400 })
  if (!rateLimit(`design:${a.user.id}`, 20, 3600_000).ok) return tooMany()
  switch (body.action) {
    case 'toggle': {
      const enabled = !!body.enabled
      const { error } = await a.admin.from('games').update({ auto_design: enabled } as never).eq('id', gameId)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, enabled })
    }
    case 'run': {
      const r = await runDesignCycle(gameId, { force: true, actor: a.user.id })
      return Response.json({ ok: r.kind !== 'failed', result: r })
    }
    case 'veto': return Response.json({ ok: true, result: await vetoExperiment(gameId, a.user.id) })
    case 'rollback': return Response.json({ ok: true, result: await rollbackLastAdopted(gameId, a.user.id) })
    default: return Response.json({ error: 'unknown action' }, { status: 400 })
  }
}
