// TokenPilot 정책 로드 (서버) — site_settings.tokenpilot_policy, 없으면 기본값
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_POLICY, type RouterPolicy } from '@/lib/llm/router'

let cache: { at: number; policy: RouterPolicy } | null = null
export async function loadPolicy(): Promise<RouterPolicy> {
  if (cache && Date.now() - cache.at < 30_000) return cache.policy
  try {
    const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'tokenpilot_policy').maybeSingle()
    const v = (data as { value?: Partial<RouterPolicy> } | null)?.value ?? {}
    const policy = { ...DEFAULT_POLICY, ...v, pins: { ...DEFAULT_POLICY.pins, ...(v.pins ?? {}) } }
    cache = { at: Date.now(), policy }
    return policy
  } catch { return DEFAULT_POLICY }
}
