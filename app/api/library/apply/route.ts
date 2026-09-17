// 게임 디자이너 접수 — 로그인 회원 누구나. 관리자가 확인 후 직분을 'designer' 로 바꾼다
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ role: null, application: null })
  const admin = createAdminClient()
  const [{ data: prof }, { data: app }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    admin.from('designer_applications').select('id,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return Response.json({ role: (prof as { role?: string } | null)?.role ?? 'user', application: app ?? null })
}
export async function POST(req: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { name?: string; email?: string; portfolio_url?: string; message?: string } | null
  const name = (body?.name ?? '').trim().slice(0, 60); const email = (body?.email ?? user.email ?? '').trim().slice(0, 120)
  if (!name || !email) return Response.json({ error: '이름과 이메일이 필요해요' }, { status: 400 })
  const admin = createAdminClient()
  const { data: dup } = await admin.from('designer_applications').select('id').eq('user_id', user.id).eq('status', 'pending').maybeSingle()
  if (dup) return Response.json({ error: '이미 접수되어 확인 중이에요' }, { status: 409 })
  const { error } = await admin.from('designer_applications').insert([{ user_id: user.id, name, email, portfolio_url: (body?.portfolio_url ?? '').trim().slice(0, 300) || null, message: (body?.message ?? '').trim().slice(0, 1000) || null }] as never)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  return Response.json({ ok: true })
}
