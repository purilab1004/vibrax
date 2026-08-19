// 관리자 템플릿 라이브러리 — 후보 목록/승인/키워드·이름 수정/삭제/미리보기
import { requireAdmin } from '@/lib/admin/guard'
import { TEMPLATES } from '@/lib/studio/templates'
import { invalidateDbTemplates } from '@/lib/studio/db-templates'
import { loadOverrides, saveOverride } from '@/lib/studio/template-overrides'

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const id = new URL(req.url).searchParams.get('preview')
  if (id) {
    // HTML 미리보기 (정적: slug, DB: uuid)
    const st = TEMPLATES.find(t => t.slug === id)
    let html = st?.html
    if (!html) { const { data } = await g.admin.from('studio_templates').select('html').eq('id', id).maybeSingle(); html = (data as { html?: string } | null)?.html }
    if (!html) return new Response('not found', { status: 404 })
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "sandbox allow-scripts allow-pointer-lock" } })
  }
  const [{ data, error }, ov, { data: useRows }] = await Promise.all([
    g.admin.from('studio_templates').select('id,slug,name,keywords,prompt,description,approved,uses,source_project_id,created_by,created_at').order('created_at', { ascending: false }).limit(500),
    loadOverrides(),
    g.admin.from('llm_usage').select('template_slug,kind').in('kind', ['template', 'template_edit']).not('template_slug', 'is', null).limit(20000),
  ])
  const uses: Record<string, { total: number; free: number }> = {}
  for (const r of (useRows ?? []) as { template_slug: string; kind: string }[]) { const u = (uses[r.template_slug] ??= { total: 0, free: 0 }); u.total++; if (r.kind === 'template') u.free++ }
  const missing = !!error && /does not exist|schema cache/i.test(error.message)
  return Response.json({
    static: TEMPLATES.map(t => ({ slug: t.slug, name: ov[t.slug]?.name ?? t.name, origName: t.name, keywords: ov[t.slug]?.keywords?.length ? ov[t.slug]!.keywords! : t.keywords, origKeywords: t.keywords, prompt: t.prompt, disabled: !!ov[t.slug]?.disabled, uses: uses[t.slug]?.total ?? 0, freeUses: uses[t.slug]?.free ?? 0 })),
    db: data ?? [], dbMissing: missing,
  })
}
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { id?: string; slug?: string; approved?: boolean; name?: string; keywords?: string[]; description?: string; disabled?: boolean } | null
  // 정적 템플릿 오버라이드 (slug 로 지정)
  if (b?.slug && !b.id) {
    if (!TEMPLATES.some(t => t.slug === b.slug)) return Response.json({ error: 'unknown slug' }, { status: 404 })
    const patch: { keywords?: string[]; name?: string; disabled?: boolean } = {}
    if (Array.isArray(b.keywords)) patch.keywords = b.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 20)
    if (b.name?.trim()) patch.name = b.name.trim()
    if (typeof b.disabled === 'boolean') patch.disabled = b.disabled
    await saveOverride(b.slug, patch)
    return Response.json({ ok: true })
  }
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.approved === 'boolean') patch.approved = b.approved
  if (b.name?.trim()) patch.name = b.name.trim()
  if (Array.isArray(b.keywords)) patch.keywords = b.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 12)
  if (typeof b.description === 'string') patch.description = b.description
  const { error } = await g.admin.from('studio_templates').update(patch as never).eq('id', b.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  invalidateDbTemplates()
  return Response.json({ ok: true })
}
export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { error } = await g.admin.from('studio_templates').delete().eq('id', b.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  invalidateDbTemplates()
  return Response.json({ ok: true })
}
