// TokenPilot 원가 가드 — LLM 원가가 매출의 N% 를 넘으면 생성 중단(적자 방지).
//   mode: 'auto'  → 기간(월/일) 원가/매출 비율이 한도(기본 60%)를 넘으면 자동 차단
//         'manual'→ 관리자가 정지 스위치를 직접 켜고 끔
//         'off'   → 가드 없음
import { createAdminClient } from '@/lib/supabase/admin'
import { KRW_PER_USD } from '@/lib/llm/pricing'

export interface CostGuard { mode: 'auto' | 'manual' | 'off'; maxRatio: number; window: 'day' | 'month'; paused: boolean; minRevenueUsd: number }
export const DEFAULT_GUARD: CostGuard = { mode: 'auto', maxRatio: 0.6, window: 'month', paused: false, minRevenueUsd: 20 }

const KEY = 'tokenpilot_guard'
let cache: { at: number; guard: CostGuard; stats: GuardStats } | null = null
export interface GuardStats { costUsd: number; revenueUsd: number; ratio: number; blocked: boolean; reason: string | null; since: string }

export async function loadGuard(): Promise<CostGuard> {
  const { data } = await createAdminClient().from('site_settings').select('value').eq('key', KEY).maybeSingle()
  return { ...DEFAULT_GUARD, ...(((data as { value?: Partial<CostGuard> } | null)?.value) ?? {}) }
}
export async function saveGuard(g: Partial<CostGuard>) {
  const cur = await loadGuard(); const next = { ...cur, ...g }
  await createAdminClient().from('site_settings').upsert({ key: KEY, value: next, updated_at: new Date().toISOString() } as never)
  cache = null
  return next
}

// 매출을 USD 로 환산: 통화 최소단위 → USD (KRW/JPY 는 0-decimal)
const toUsd = (minor: number, cur: string | null) => {
  const c = (cur ?? 'USD').toUpperCase()
  if (c === 'USD') return minor / 100
  if (c === 'KRW') return minor / KRW_PER_USD
  if (c === 'JPY') return minor / 150
  if (c === 'EUR') return (minor / 100) * 1.08
  if (c === 'GBP') return (minor / 100) * 1.27
  if (c === 'AUD') return (minor / 100) * 0.66
  return minor / 100
}

export async function guardStatus(force = false): Promise<{ guard: CostGuard; stats: GuardStats }> {
  if (!force && cache && Date.now() - cache.at < 60_000) return { guard: cache.guard, stats: cache.stats }
  const admin = createAdminClient()
  const guard = await loadGuard()
  try { const { loadAutomation } = await import('@/lib/automation'); const a = await loadAutomation(); if (!a['tokenpilot.guard'] && guard.mode === 'auto') guard.mode = 'manual' } catch { /* ignore */ }
  const now = new Date()
  const since = guard.window === 'day' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth(), 1)
  const [{ data: costRows }, { data: payRows }] = await Promise.all([
    admin.from('llm_usage').select('cost_usd').gte('created_at', since.toISOString()).limit(20000),
    admin.from('payments').select('amount_minor,currency,status,refunded_minor').gte('created_at', since.toISOString()).limit(5000),
  ])
  const costUsd = ((costRows ?? []) as { cost_usd: number }[]).reduce((a, r) => a + Number(r.cost_usd), 0)
  const revenueUsd = ((payRows ?? []) as { amount_minor: number | null; currency: string | null; status: string; refunded_minor: number | null }[])
    .filter(p => ['completed', 'partially_refunded', 'refund_pending'].includes(p.status))
    .reduce((a, p) => a + toUsd(Math.max(0, (p.amount_minor ?? 0) - (p.refunded_minor ?? 0)), p.currency), 0)
  const ratio = revenueUsd > 0 ? costUsd / revenueUsd : (costUsd > 0 ? Infinity : 0)
  let blocked = false, reason: string | null = null
  if (guard.mode === 'manual') { blocked = guard.paused; reason = blocked ? '관리자가 생성을 일시 중지했어요.' : null }
  else if (guard.mode === 'auto') {
    // 매출이 최소 기준(minRevenueUsd) 미만인 초기엔 비율 판단이 무의미 → 절대 원가가 minRevenue×maxRatio 를 넘을 때만 차단
    const cap = Math.max(revenueUsd, guard.minRevenueUsd) * guard.maxRatio
    blocked = costUsd > cap
    reason = blocked ? `LLM 원가가 매출의 ${Math.round(guard.maxRatio * 100)}% 한도를 넘어 자동으로 생성을 멈췄어요.` : null
    if (blocked && !(cache?.stats.blocked)) { try { const { logAutomation } = await import('@/lib/automation'); void logAutomation({ module: 'tokenpilot', action: '원가 한도 초과 → 생성 자동 중지', status: 'needs_review', detail: { costUsd, revenueUsd, ratio } }) } catch { /* ignore */ } }
  }
  const stats: GuardStats = { costUsd, revenueUsd, ratio, blocked, reason, since: since.toISOString() }
  cache = { at: Date.now(), guard, stats }
  return { guard, stats }
}
