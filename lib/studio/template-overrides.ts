// 정적 템플릿 오버라이드(관리자 설정) — 키워드 변경/이름/사용 여부(삭제=비활성). site_settings.static_template_overrides
import { createAdminClient } from '@/lib/supabase/admin'
import { TEMPLATES, type GameTemplate } from '@/lib/studio/templates'

export interface StaticOverride { keywords?: string[]; name?: string; disabled?: boolean }
const KEY = 'static_template_overrides'
let cache: { at: number; map: Record<string, StaticOverride> } | null = null

export async function loadOverrides(): Promise<Record<string, StaticOverride>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map
  try {
    const { data } = await createAdminClient().from('site_settings').select('value').eq('key', KEY).maybeSingle()
    const map = ((data as { value?: Record<string, StaticOverride> } | null)?.value) ?? {}
    cache = { at: Date.now(), map }
    return map
  } catch { return cache?.map ?? {} }
}
export async function saveOverride(slug: string, patch: StaticOverride) {
  const cur = await loadOverrides()
  const next = { ...cur, [slug]: { ...(cur[slug] ?? {}), ...patch } }
  await createAdminClient().from('site_settings').upsert({ key: KEY, value: next, updated_at: new Date().toISOString() } as never)
  cache = null
  return next
}
/** 오버라이드가 적용된 활성 정적 템플릿 목록 */
export async function effectiveStaticTemplates(): Promise<GameTemplate[]> {
  const ov = await loadOverrides()
  return TEMPLATES.filter(t => !ov[t.slug]?.disabled).map(t => ({ ...t, name: ov[t.slug]?.name ?? t.name, keywords: ov[t.slug]?.keywords?.length ? ov[t.slug]!.keywords! : t.keywords }))
}
