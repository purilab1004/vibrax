// DB 템플릿 — 처음 생성된 게임을 후보로 저장하고, 승인된 것만 매칭에 사용 (서버 전용)
import { createAdminClient } from '@/lib/supabase/admin'
import type { GameTemplate } from '@/lib/studio/templates'

const STOP = new Set(['게임', '게임을', '만들어줘', '만들어', '만들어주세요', '만들기', '제작', '제작해줘', '해줘', '주세요', '부탁', '하나', '좀', '나만의', '간단한', '간단히', '클래식', '기본', '스타일', '스타일의', '같은', '처럼', '으로', '그리고', '있는', '되는', '하는', '위한', 'make', 'me', 'a', 'an', 'the', 'game', 'please', 'create', 'build', 'simple', 'classic', 'style', 'like', 'with', 'and', 'that', 'this'])
export function extractKeywords(prompt: string, title?: string | null): string[] {
  const toks = prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map(t => t.replace(/(을|를|이|가|은|는|의|로|으로|에서|에게|과|와)$/u, '')).filter(t => t.length >= 2 && !STOP.has(t))
  const uniq = [...new Set(toks)].slice(0, 6)
  if (title && title.length >= 2 && !uniq.includes(title.toLowerCase())) uniq.unshift(title.toLowerCase())
  return uniq
}

let cache: { at: number; list: GameTemplate[] } | null = null
export async function loadDbTemplates(): Promise<GameTemplate[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list
  try {
    const { data } = await createAdminClient().from('studio_templates').select('id,slug,name,keywords,prompt,description,html').eq('approved', true).limit(300)
    const list = ((data ?? []) as { id: string; slug: string | null; name: string; keywords: string[]; prompt: string; description: string | null; html: string }[])
      .map(t => ({ slug: t.slug ?? `db-${t.id}`, name: t.name, keywords: t.keywords ?? [], prompt: t.prompt, description: t.description ?? '', html: t.html }))
    cache = { at: Date.now(), list }
    return list
  } catch { return cache?.list ?? [] }
}
export function invalidateDbTemplates() { cache = null }

/** 첫 생성 결과를 템플릿 후보로 저장 (관리자 승인 전까지는 매칭에 안 씀) */
export async function saveTemplateCandidate(p: { prompt: string; title: string | null; description: string; html: string; projectId: string; userId: string }) {
  try {
    const admin = createAdminClient()
    const keywords = extractKeywords(p.prompt, p.title)
    const slug = (p.title ?? keywords[0] ?? 'game').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6)
    await admin.from('studio_templates').insert([{ slug, name: p.title ?? keywords[0] ?? '새 게임', keywords, prompt: p.prompt, description: p.description, html: p.html, source_project_id: p.projectId, created_by: p.userId }] as never)
  } catch (e) { console.warn('[templates] candidate save failed', e) }
}
export async function bumpTemplateUse(slug: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('studio_templates').select('id,uses').eq('slug', slug).maybeSingle()
    if (data) await admin.from('studio_templates').update({ uses: ((data as { uses: number }).uses ?? 0) + 1 } as never).eq('id', (data as { id: string }).id)
  } catch { /* ignore */ }
}
