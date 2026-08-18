// 회원 관리 API (service role) — 생성 / 관리자 종류·정지 변경 / 삭제
import { requireAdmin, SUPER_ADMIN_EMAILS } from '@/lib/admin/guard'

const isProtected = (email: string | null | undefined) => !!email && SUPER_ADMIN_EMAILS.includes(email)

// POST { email, password, username?, adminRoleId? } → 회원 추가
export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { email?: string; password?: string; username?: string; adminRoleId?: string | null } | null
  const email = body?.email?.trim().toLowerCase(); const password = body?.password ?? ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: '이메일 형식이 올바르지 않아요.' }, { status: 400 })
  if (password.length < 6) return Response.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 })
  const { data, error } = await g.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: body?.username ? { username: body.username } : undefined })
  if (error) return Response.json({ error: /already|exists|registered/i.test(error.message) ? '이미 가입된 이메일이에요.' : error.message }, { status: 400 })
  const id = data.user.id
  const patch: Record<string, unknown> = {}
  if (body?.username?.trim()) patch.username = body.username.trim()
  if (body?.adminRoleId) { patch.admin_role_id = body.adminRoleId; patch.role = 'admin' }
  if (Object.keys(patch).length) {
    // 프로필 트리거가 늦을 수 있어 upsert
    const { error: pErr } = await g.admin.from('profiles').upsert({ id, ...patch } as never, { onConflict: 'id' })
    if (pErr) console.error('[admin/members] profile patch', pErr)
  }
  return Response.json({ ok: true, id })
}

// PATCH { userId, adminRoleId?: string|null, banned?: boolean } → 관리자 종류 / 정지
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { userId?: string; adminRoleId?: string | null; banned?: boolean } | null
  if (!body?.userId) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data: u } = await g.admin.auth.admin.getUserById(body.userId)
  const email = u?.user?.email
  const patch: Record<string, unknown> = {}
  if ('adminRoleId' in body) {
    if (isProtected(email) && !body.adminRoleId) return Response.json({ error: '슈퍼관리자 계정은 관리자에서 뺄 수 없어요.' }, { status: 400 })
    if (body.userId === g.user.id && !body.adminRoleId) return Response.json({ error: '자기 자신의 관리자 권한은 뺄 수 없어요.' }, { status: 400 })
    patch.admin_role_id = body.adminRoleId ?? null
    patch.role = body.adminRoleId ? 'admin' : 'user'
  }
  if (typeof body.banned === 'boolean') {
    if (isProtected(email) && body.banned) return Response.json({ error: '슈퍼관리자 계정은 차단할 수 없어요.' }, { status: 400 })
    if (body.userId === g.user.id && body.banned) return Response.json({ error: '자기 자신은 차단할 수 없어요.' }, { status: 400 })
    patch.banned_at = body.banned ? new Date().toISOString() : null
  }
  if (!Object.keys(patch).length) return Response.json({ error: 'nothing to do' }, { status: 400 })
  const { error } = await g.admin.from('profiles').update(patch as never).eq('id', body.userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE { userId } → 회원 완전 삭제 (데이터 정리 → auth 계정 삭제)
export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { userId?: string } | null
  if (!body?.userId) return Response.json({ error: 'bad request' }, { status: 400 })
  if (body.userId === g.user.id) return Response.json({ error: '자기 자신은 삭제할 수 없어요.' }, { status: 400 })
  const { data: u } = await g.admin.auth.admin.getUserById(body.userId)
  if (!u?.user) return Response.json({ error: '회원을 찾을 수 없어요.' }, { status: 404 })
  if (isProtected(u.user.email)) return Response.json({ error: '슈퍼관리자 계정은 삭제할 수 없어요.' }, { status: 400 })
  const { error: pErr } = await g.admin.rpc('admin_purge_member', { p_user_id: body.userId } as never)
  if (pErr && !/does not exist|function/i.test(pErr.message)) return Response.json({ error: `데이터 정리 실패: ${pErr.message}` }, { status: 500 })
  const { error } = await g.admin.auth.admin.deleteUser(body.userId)
  if (error) return Response.json({ error: `계정 삭제 실패: ${error.message}` }, { status: 500 })
  return Response.json({ ok: true })
}
