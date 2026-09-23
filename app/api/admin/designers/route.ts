// 관리자 — 디자이너 접수 목록/승인·거절(직분 변경), 승인 대기 에셋 목록/승인·거절
import { requireAdmin } from '@/lib/admin/guard'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const [{ data: apps, error: e1 }, { data: pending, error: e2 }, { data: designers }] = await Promise.all([
    g.admin.from('designer_applications').select('*').order('created_at', { ascending: false }).limit(200),
    g.admin.from('media_assets').select('id,kind,name,title,description,tags,url,width,height,bytes,status,created_at,designer_id').in('status', ['pending', 'rejected']).order('created_at', { ascending: false }).limit(200),
    g.admin.from('profiles').select('id,username,agent_name,email,created_at').eq('role', 'designer').order('created_at', { ascending: false }).limit(200),
  ])
  const err = e1 ?? e2
  if (err) return Response.json({ error: err.message, missing: /does not exist|schema cache/i.test(err.message) }, { status: 500 })
  const ids = [...new Set((pending ?? []).map((a) => (a as { designer_id: string | null }).designer_id).filter((x): x is string => !!x))]
  const names: Record<string, string> = {}
  if (ids.length) { const { data: profs } = await g.admin.from('profiles').select('id,username,agent_name,email').in('id', ids); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null; email?: string | null }[]) names[p.id] = `${p.agent_name ?? p.username ?? '디자이너'}${p.email ? ` (${p.email})` : ''}` }
  return Response.json({ applications: apps ?? [], pending: (pending ?? []).map((a) => ({ ...(a as object), designer_name: names[(a as { designer_id: string | null }).designer_id ?? ''] ?? null })), designers: designers ?? [] })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { type?: 'application' | 'asset'; id?: string; action?: 'approve' | 'reject' } | null
  if (!body?.type || !body.id || !body.action) return Response.json({ error: 'bad request' }, { status: 400 })
  if (body.type === 'application') {
    const { data: app } = await g.admin.from('designer_applications').select('user_id').eq('id', body.id).maybeSingle()
    if (!app) return Response.json({ error: 'not found' }, { status: 404 })
    await g.admin.from('designer_applications').update({ status: body.action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: g.user.id }).eq('id', body.id)
    if (body.action === 'approve') { const { error } = await g.admin.from('profiles').update({ role: 'designer' }).eq('id', (app as { user_id: string }).user_id).neq('role', 'admin'); if (error) return Response.json({ error: error.message }, { status: 500 }) }
    return Response.json({ ok: true })
  }
  const { error } = await g.admin.from('media_assets').update({ status: body.action === 'approve' ? 'active' : 'rejected' }).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
