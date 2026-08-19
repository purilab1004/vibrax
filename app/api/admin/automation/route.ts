// 자동화 스위치 + 상태(메뉴별 on/off/error) + 처리 내역 + 초기화/검토
import { requireAdmin } from '@/lib/admin/guard'
import { AUTOMATION_MODULES, loadAutomation, saveAutomation, type AutomationKey } from '@/lib/automation'

export const MENU_MODULE: Record<string, string> = { '/admin/templates': 'templates', '/admin/mlpilot': 'mlpilot', '/admin/costs': 'tokenpilot', '/admin/ads': 'adpilot', '/admin/blog': 'blog', '/admin/aj': 'aj', '/admin/payments': 'payments', '/admin/broadcasts': 'broadcasts', '/admin/security': 'security' }

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const url = new URL(req.url); const full = url.searchParams.get('full') === '1'
  const flags = await loadAutomation()
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data: errs } = await g.admin.from('automation_logs').select('module,status,created_at').gte('created_at', since24).in('status', ['error', 'needs_review']).is('reviewed_at', null).limit(2000)
  const errRows = (errs ?? []) as { module: string; status: string }[]
  // 모듈 상태: 해당 모듈의 자동화 스위치가 하나라도 on → 'on', 아니면 'off'; 24h 내 미검토 error → 'error'
  const health: Record<string, { state: 'on' | 'off' | 'error'; errors: number; review: number }> = {}
  for (const m of AUTOMATION_MODULES) { const mod = m.key.split('.')[0]; const h = (health[mod] ??= { state: 'off', errors: 0, review: 0 }); if (flags[m.key]) h.state = 'on' }
  for (const r of errRows) { const h = (health[r.module] ??= { state: 'off', errors: 0, review: 0 }); if (r.status === 'error') { h.errors++; h.state = 'error' } else h.review++ }
  if (!full) return Response.json({ flags, health, menuModule: MENU_MODULE })
  const { data: logs, error } = await g.admin.from('automation_logs').select('id,module,action,target,status,detail,reviewed_at,created_at').order('created_at', { ascending: false }).limit(300)
  // 사람이 봐야 할 항목(대기) 집계
  const [{ count: pendTemplates }, { count: pendRefund }, { count: failedPay }, { count: openErrors }, { count: secHigh }] = await Promise.all([
    g.admin.from('studio_templates').select('id', { count: 'exact', head: true }).eq('approved', false),
    g.admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'refund_pending'),
    g.admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since24),
    g.admin.from('app_errors').select('id', { count: 'exact', head: true }).is('resolved_at', null).gte('created_at', since24),
    g.admin.from('security_events').select('id', { count: 'exact', head: true }).eq('severity', 'high').gte('created_at', since24),
  ])
  return Response.json({ flags, health, menuModule: MENU_MODULE, modules: AUTOMATION_MODULES, logs: error ? [] : logs ?? [], logsMissing: !!error && /does not exist|schema cache/i.test(error.message),
    pending: { templates: pendTemplates ?? 0, refunds: pendRefund ?? 0, failedPayments: failedPay ?? 0, openErrors: openErrors ?? 0, securityHigh: secHigh ?? 0, review: errRows.filter(r => r.status === 'needs_review').length, errors: errRows.filter(r => r.status === 'error').length } })
}
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { flags?: Partial<Record<AutomationKey, boolean>>; resetModule?: string; reviewId?: string } | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  if (b.flags) { const clean: Partial<Record<AutomationKey, boolean>> = {}; for (const m of AUTOMATION_MODULES) if (typeof b.flags[m.key] === 'boolean') clean[m.key] = b.flags[m.key]; await saveAutomation(clean) }
  if (b.resetModule) { await g.admin.from('automation_logs').update({ reviewed_at: new Date().toISOString(), reviewed_by: g.user.id } as never).eq('module', b.resetModule).is('reviewed_at', null); await g.admin.from('automation_logs').insert([{ module: b.resetModule, action: '관리자 초기화 — 오류/검토 항목 확인 처리', status: 'ok', detail: { by: g.user.id } }] as never) }
  if (b.reviewId) await g.admin.from('automation_logs').update({ reviewed_at: new Date().toISOString(), reviewed_by: g.user.id } as never).eq('id', b.reviewId)
  return Response.json({ ok: true, flags: await loadAutomation() })
}
