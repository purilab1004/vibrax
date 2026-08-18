// 관리자 종류 CRUD (service role)
import { requireAdmin } from '@/lib/admin/guard'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data, error } = await g.admin.from('admin_roles').select('*').order('sort_order').order('created_at')
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  return Response.json({ roles: data ?? [] })
}

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { name?: string; color?: string; description?: string; permissions?: Record<string, boolean> } | null
  const name = b?.name?.trim()
  if (!name) return Response.json({ error: '이름을 입력하세요.' }, { status: 400 })
  const { data, error } = await g.admin.from('admin_roles').insert({ name, color: b?.color || '#2563eb', description: b?.description?.trim() || null, permissions: b?.permissions ?? {} } as never).select('*').maybeSingle()
  if (error) return Response.json({ error: /duplicate/i.test(error.message) ? '같은 이름이 이미 있어요.' : error.message }, { status: 400 })
  return Response.json({ role: data })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { id?: string; name?: string; color?: string; description?: string; permissions?: Record<string, boolean> } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data: cur } = await g.admin.from('admin_roles').select('is_system').eq('id', b.id).maybeSingle()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.name?.trim() && !(cur as { is_system?: boolean } | null)?.is_system) patch.name = b.name.trim()
  if (b.color) patch.color = b.color
  if ('description' in b) patch.description = b.description?.trim() || null
  if (b.permissions && !(cur as { is_system?: boolean } | null)?.is_system) patch.permissions = b.permissions
  const { data, error } = await g.admin.from('admin_roles').update(patch as never).eq('id', b.id).select('*').maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ role: data })
}

export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { id?: string; reassignTo?: string | null } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data: cur } = await g.admin.from('admin_roles').select('is_system').eq('id', b.id).maybeSingle()
  if ((cur as { is_system?: boolean } | null)?.is_system) return Response.json({ error: '슈퍼관리자 종류는 삭제할 수 없어요.' }, { status: 400 })
  // 이 종류를 가진 회원 → 다른 종류로 옮기거나 일반 회원으로
  const { data: members } = await g.admin.from('profiles').select('id').eq('admin_role_id', b.id)
  const ids = ((members ?? []) as { id: string }[]).map(m => m.id)
  if (ids.length) {
    const { error: mErr } = await g.admin.from('profiles').update({ admin_role_id: b.reassignTo ?? null, role: b.reassignTo ? 'admin' : 'user' } as never).in('id', ids)
    if (mErr) return Response.json({ error: mErr.message }, { status: 500 })
  }
  const { error } = await g.admin.from('admin_roles').delete().eq('id', b.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, moved: ids.length })
}
