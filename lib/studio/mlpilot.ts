// MLPilot 설정 + 프롬프트 매핑 로그 (서버 전용)
import { createAdminClient } from '@/lib/supabase/admin'
export interface MlPilotSettings { enabled: boolean; threshold: number; model: 'similarity-v1'; aiJudge: boolean; autoLearn: boolean }
// aiJudge: 키워드·유사도로 못 잡으면 Haiku(초저가)에게 '어느 템플릿인가' 만 묻는다(생성 대비 1/1000 비용). autoLearn: 매핑 성공 시 프롬프트 핵심 표현을 키워드로 자동 등록.
export const DEFAULT_ML: MlPilotSettings = { enabled: true, threshold: 0.42, model: 'similarity-v1', aiJudge: true, autoLearn: true }
let cache: { at: number; v: MlPilotSettings } | null = null
export async function loadMl(): Promise<MlPilotSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'mlpilot').maybeSingle(); const v = { ...DEFAULT_ML, ...(((data as { value?: Partial<MlPilotSettings> } | null)?.value) ?? {}) }; cache = { at: Date.now(), v }; return v } catch { return DEFAULT_ML }
}
export async function saveMl(p: Partial<MlPilotSettings>) { const cur = await loadMl(); const v = { ...cur, ...p }; await createAdminClient().from('site_settings').upsert({ key: 'mlpilot', value: v, updated_at: new Date().toISOString() } as never); cache = null; return v }
export async function logMapping(row: { userId: string; projectId: string; prompt: string; templateSlug: string | null; method: 'keyword' | 'similarity' | 'manual' | 'ml' | 'none'; confidence: number | null; usedLlm: boolean }) {
  try { await createAdminClient().from('prompt_mappings').insert([{ user_id: row.userId, project_id: row.projectId, prompt: row.prompt.slice(0, 2000), normalized: row.prompt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500), template_slug: row.templateSlug, method: row.method, confidence: row.confidence, used_llm: row.usedLlm }] as never) } catch { /* ignore */ }
}

/** 자동 키워드 학습 — 템플릿(정적/DB) 키워드에 표현 추가 */
export async function learnKeyword(slug: string, keyword: string) {
  const kw = keyword.trim().toLowerCase()
  if (kw.length < 2 || kw.length > 40) return
  try {
    const { TEMPLATES } = await import('@/lib/studio/templates')
    if (TEMPLATES.some(t => t.slug === slug)) {
      const { loadOverrides, saveOverride } = await import('@/lib/studio/template-overrides')
      const ov = await loadOverrides(); const base = ov[slug]?.keywords?.length ? ov[slug]!.keywords! : TEMPLATES.find(t => t.slug === slug)!.keywords
      if (!base.includes(kw)) await saveOverride(slug, { keywords: [...base, kw].slice(0, 40) })
    } else {
      const admin = createAdminClient()
      const { data } = await admin.from('studio_templates').select('id,keywords').eq('slug', slug).maybeSingle()
      if (data) { const cur = ((data as { keywords: string[] }).keywords ?? []); if (!cur.includes(kw)) { await admin.from('studio_templates').update({ keywords: [...cur, kw].slice(0, 40) } as never).eq('id', (data as { id: string }).id); const { invalidateDbTemplates } = await import('@/lib/studio/db-templates'); invalidateDbTemplates() } }
    }
  } catch { /* ignore */ }
}
