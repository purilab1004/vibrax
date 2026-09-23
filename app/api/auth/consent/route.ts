// 약관/마케팅 동의 저장 (로그인 사용자 본인)
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { terms?: boolean; privacy?: boolean; marketing?: boolean } | null
  if (!b?.terms || !b.privacy) return Response.json({ error: '필수 약관에 동의해야 해요.' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const now = new Date().toISOString()
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ terms_agreed_at: now, marketing_opt_in: !!b.marketing, marketing_agreed_at: b.marketing ? now : null } as never).eq('id', user.id)
  if (error) { console.warn('[consent]', error.message); return Response.json({ ok: true, stored: false }) }  // 컬럼 미생성 등 — 흐름은 막지 않음
  await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, terms_agreed_at: now, marketing_opt_in: !!b.marketing } }).catch(() => {})
  return Response.json({ ok: true, stored: true })
}
