// 관리자 API 공통 가드 — 로그인 + profiles.role='admin' 확인. 실패 시 Response 반환.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const SUPER_ADMIN_EMAILS = ['puridev1155@gmail.com']

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: 'unauthorized' }, { status: 401 }) } as const
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isSuper = SUPER_ADMIN_EMAILS.includes(user.email ?? '')
  if ((prof as { role?: string } | null)?.role !== 'admin' && !isSuper) return { error: Response.json({ error: 'forbidden' }, { status: 403 }) } as const
  return { user, isSuper, admin: createAdminClient() } as const
}
