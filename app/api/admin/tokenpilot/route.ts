// TokenPilot 정책 저장 (관리자)
import { requireAdmin } from '@/lib/admin/guard'
import { DEFAULT_POLICY, MODEL_CATALOG, type RouterPolicy } from '@/lib/llm/router'
import { guardStatus, saveGuard, type CostGuard } from '@/lib/tokenpilot/guard'

export async function PUT(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as Partial<RouterPolicy> | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  const pins: RouterPolicy['pins'] = {}
  for (const [k, v] of Object.entries(b.pins ?? {})) if (typeof v === 'string' && MODEL_CATALOG[v]) (pins as Record<string, string>)[k] = v
  const policy: RouterPolicy = {
    pins,
    autoDowngradeSmallEdits: !!b.autoDowngradeSmallEdits,
    smallEditMaxHtmlChars: Math.max(1000, Math.min(200000, Number(b.smallEditMaxHtmlChars) || DEFAULT_POLICY.smallEditMaxHtmlChars)),
    targetMargin: Math.max(1, Math.min(20, Number(b.targetMargin) || DEFAULT_POLICY.targetMargin)),
    krwPerCredit: Math.max(1, Math.min(10000, Number(b.krwPerCredit) || DEFAULT_POLICY.krwPerCredit)),
  }
  const { error } = await g.admin.from('site_settings').upsert({ key: 'tokenpilot_policy', value: policy, updated_at: new Date().toISOString() } as never)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, policy })
}

// 원가 가드 상태 조회
export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const r = await guardStatus(true)
  return Response.json(r)
}
// 원가 가드 설정 (mode / maxRatio / window / paused)
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as Partial<CostGuard> | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  const patch: Partial<CostGuard> = {}
  if (b.mode && ['auto', 'manual', 'off'].includes(b.mode)) patch.mode = b.mode
  if (typeof b.maxRatio === 'number' && b.maxRatio > 0 && b.maxRatio <= 5) patch.maxRatio = b.maxRatio
  if (b.window === 'day' || b.window === 'month') patch.window = b.window
  if (typeof b.paused === 'boolean') patch.paused = b.paused
  if (typeof b.minRevenueUsd === 'number' && b.minRevenueUsd >= 0) patch.minRevenueUsd = b.minRevenueUsd
  const guard = await saveGuard(patch)
  const r = await guardStatus(true)
  return Response.json({ guard, stats: r.stats })
}
