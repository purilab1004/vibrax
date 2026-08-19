// MLPilot 설정 + 프롬프트 매핑 로그 (서버 전용)
import { createAdminClient } from '@/lib/supabase/admin'
export interface MlPilotSettings { enabled: boolean; threshold: number; model: 'similarity-v1' }
export const DEFAULT_ML: MlPilotSettings = { enabled: true, threshold: 0.42, model: 'similarity-v1' }
let cache: { at: number; v: MlPilotSettings } | null = null
export async function loadMl(): Promise<MlPilotSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'mlpilot').maybeSingle(); const v = { ...DEFAULT_ML, ...(((data as { value?: Partial<MlPilotSettings> } | null)?.value) ?? {}) }; cache = { at: Date.now(), v }; return v } catch { return DEFAULT_ML }
}
export async function saveMl(p: Partial<MlPilotSettings>) { const cur = await loadMl(); const v = { ...cur, ...p }; await createAdminClient().from('site_settings').upsert({ key: 'mlpilot', value: v, updated_at: new Date().toISOString() } as never); cache = null; return v }
export async function logMapping(row: { userId: string; projectId: string; prompt: string; templateSlug: string | null; method: 'keyword' | 'similarity' | 'manual' | 'ml' | 'none'; confidence: number | null; usedLlm: boolean }) {
  try { await createAdminClient().from('prompt_mappings').insert([{ user_id: row.userId, project_id: row.projectId, prompt: row.prompt.slice(0, 2000), normalized: row.prompt.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500), template_slug: row.templateSlug, method: row.method, confidence: row.confidence, used_llm: row.usedLlm }] as never) } catch { /* ignore */ }
}
