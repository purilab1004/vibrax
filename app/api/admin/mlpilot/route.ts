// MLPilot — 프롬프트→템플릿 매핑 현황(LLM 없이 처리 비율), 미매핑 프롬프트, 설정, 수동 매핑(키워드 학습)
import { requireAdmin } from '@/lib/admin/guard'
import { loadMl, saveMl } from '@/lib/studio/mlpilot'
import { effectiveStaticTemplates, saveOverride, loadOverrides } from '@/lib/studio/template-overrides'
import { loadDbTemplates, invalidateDbTemplates } from '@/lib/studio/db-templates'
import { rankTemplates } from '@/lib/studio/similarity'
import { TEMPLATES } from '@/lib/studio/templates'

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const days = Math.max(1, Math.min(90, Number(new URL(req.url).searchParams.get('days') ?? 30)))
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const [{ data, error }, settings, statics, dbs] = await Promise.all([
    g.admin.from('prompt_mappings').select('id,prompt,template_slug,method,confidence,used_llm,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
    loadMl(), effectiveStaticTemplates(), loadDbTemplates(),
  ])
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as { id: string; prompt: string; template_slug: string | null; method: string; confidence: number | null; used_llm: boolean; created_at: string }[]
  const total = rows.length, free = rows.filter(r => !r.used_llm).length
  const byMethod: Record<string, number> = {}; for (const r of rows) byMethod[r.method] = (byMethod[r.method] ?? 0) + 1
  const byDay: Record<string, { total: number; free: number }> = {}
  for (let i = days - 1; i >= 0; i--) byDay[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = { total: 0, free: 0 }
  for (const r of rows) { const d = r.created_at.slice(0, 10); if (byDay[d]) { byDay[d].total++; if (!r.used_llm) byDay[d].free++ } }
  // 미매핑 프롬프트(LLM 사용) — 유사 템플릿 후보 제안 (유사도 상위 3)
  const all = [...statics, ...dbs].map(t => ({ slug: t.slug, name: t.name, text: `${t.name} ${t.keywords.join(' ')} ${t.prompt} ${t.description}` }))
  const unmapped = rows.filter(r => r.used_llm && r.method === 'none').slice(0, 100).map(r => ({ ...r, suggestions: rankTemplates(r.prompt, all).slice(0, 3).map(x => ({ slug: x.slug, name: all.find(a => a.slug === x.slug)?.name ?? x.slug, score: Math.round(x.score * 100) / 100 })) }))
  return Response.json({ days, settings, total, free, ratio: total ? free / total : 0, byMethod, byDay: Object.entries(byDay).map(([day, v]) => ({ day, ...v })), unmapped, recent: rows.slice(0, 50), templates: all.map(a => ({ slug: a.slug, name: a.name })) })
}
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { enabled?: boolean; threshold?: number } | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  const v = await saveMl({ ...(typeof b.enabled === 'boolean' ? { enabled: b.enabled } : {}), ...(typeof b.threshold === 'number' && b.threshold > 0 && b.threshold < 1 ? { threshold: b.threshold } : {}) })
  return Response.json({ settings: v })
}
// 수동 매핑 학습: 프롬프트(또는 지정 키워드)를 템플릿 키워드에 추가 → 이후 같은 표현은 LLM 없이 처리
export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { slug?: string; keyword?: string; mappingId?: string } | null
  if (!b?.slug || !b.keyword?.trim()) return Response.json({ error: 'bad request' }, { status: 400 })
  const kw = b.keyword.trim().toLowerCase()
  if (TEMPLATES.some(t => t.slug === b.slug)) {
    const ov = await loadOverrides(); const base = ov[b.slug!]?.keywords?.length ? ov[b.slug!]!.keywords! : TEMPLATES.find(t => t.slug === b.slug)!.keywords
    await saveOverride(b.slug, { keywords: [...new Set([...base, kw])] })
  } else {
    const { data } = await g.admin.from('studio_templates').select('id,keywords').eq('slug', b.slug).maybeSingle()
    if (!data) return Response.json({ error: 'template not found' }, { status: 404 })
    await g.admin.from('studio_templates').update({ keywords: [...new Set([...((data as { keywords: string[] }).keywords ?? []), kw])] } as never).eq('id', (data as { id: string }).id)
    invalidateDbTemplates()
  }
  if (b.mappingId) await g.admin.from('prompt_mappings').update({ template_slug: b.slug, method: 'manual', confidence: 1 } as never).eq('id', b.mappingId)
  return Response.json({ ok: true })
}
