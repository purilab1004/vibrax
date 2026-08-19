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

// 관리자가 템플릿을 직접 추가 — HTML 을 붙여넣거나, 프롬프트만 주면 Claude 로 생성(기본 사양 권장). 바로 승인 상태로 저장.
export const maxDuration = 300
export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { name?: string; keywords?: string[]; prompt?: string; html?: string; description?: string; basicSpec?: boolean } | null
  if (!b?.name?.trim() || !Array.isArray(b.keywords) || b.keywords.length === 0) return Response.json({ error: '이름과 키워드는 필수예요.' }, { status: 400 })
  const keywords = b.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 20)
  let html = (b.html ?? '').trim(); let description = (b.description ?? '').trim(); const prompt = (b.prompt ?? '').trim() || b.name.trim()
  if (!html) {
    if (!prompt) return Response.json({ error: '프롬프트 또는 HTML 중 하나는 필요해요.' }, { status: 400 })
    try {
      const [{ default: Anthropic }, { SYSTEM_PROMPT, buildMessages }, { parseGeneration }, { hardenHtml }, { GENERATION_MAX_TOKENS }] = await Promise.all([
        import('@anthropic-ai/sdk'), import('@/lib/studio/prompt'), import('@/lib/studio/parse'), import('@/lib/studio/harden'), import('@/lib/llm/pricing')])
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const effective = b.basicSpec === false ? prompt : `${prompt}\n\n[템플릿 기본 사양] 꾸밈 요소 없이 핵심 규칙만 — 시작 화면, 조작(키보드+터치), 점수, 게임오버·재시작. 단색 배경, 단순 도형 위주, 특정 브랜드/상표 이름·로고 금지. 나중에 회원이 수정 요청으로 살을 붙일 수 있게 깔끔하고 짧게.`
      const msg = await client.messages.stream({ model: 'claude-sonnet-5', max_tokens: GENERATION_MAX_TOKENS, system: SYSTEM_PROMPT, messages: buildMessages({ prompt: effective, currentHtml: null, history: [], images: [] }) as never }).finalMessage()
      const text = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
      const parsed = parseGeneration(text)
      if (!parsed.html) return Response.json({ error: '생성 결과에 게임 HTML 이 없어요. 프롬프트를 바꿔 다시 시도하세요.', detail: parsed.description.slice(0, 300) }, { status: 502 })
      html = hardenHtml(parsed.html); description = description || parsed.description.slice(0, 500)
      void g.admin.from('llm_usage').insert([{ user_id: g.user.id, kind: 'admin_template', model: 'claude-sonnet-5', input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, credits: 0, cost_usd: (msg.usage.input_tokens * 3 + msg.usage.output_tokens * 15) / 1e6 }] as never).then(() => {})
    } catch (e) { return Response.json({ error: `생성 실패: ${(e as Error).message}` }, { status: 500 }) }
  }
  const slug = b.name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6)
  const { data, error } = await g.admin.from('studio_templates').insert([{ slug, name: b.name.trim(), keywords, prompt, description: description || null, html, created_by: g.user.id, approved: true }] as never).select('id').maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  invalidateDbTemplates()
  return Response.json({ ok: true, id: (data as { id: string } | null)?.id, slug, generated: !b.html })
}
