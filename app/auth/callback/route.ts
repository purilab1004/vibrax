// OAuth / 매직링크 콜백 — code 를 세션으로 교환하고 next 로 이동.
// 세션 쿠키를 리다이렉트 응답에 직접 실어 보낸다 (Route Handler 에서 cookies() 만으로는 누락될 수 있음).
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const target = new URL(safeNext, url.origin)
  const res = NextResponse.redirect(target)
  if (!code) return NextResponse.redirect(new URL(`/login?error=oauth&redirect=${encodeURIComponent(safeNext)}`, url.origin))
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return req.cookies.getAll() },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
    },
  })
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback]', error.message)
    return NextResponse.redirect(new URL(`/login?error=oauth&redirect=${encodeURIComponent(safeNext)}`, url.origin))
  }
  // 첫 소셜 가입자(약관 미동의) → 동의 페이지 먼저 (컬럼이 없거나 조회 실패면 통과)
  try {
    const uid = data.user?.id
    if (uid) {
      const { data: p, error: pe } = await createAdminClient().from('profiles').select('terms_agreed_at').eq('id', uid).maybeSingle()
      if (!pe && p && !(p as { terms_agreed_at?: string | null }).terms_agreed_at) {
        const consentUrl = new URL(`/consent?next=${encodeURIComponent(safeNext)}`, url.origin)
        const r2 = NextResponse.redirect(consentUrl)
        res.cookies.getAll().forEach(c => r2.cookies.set(c))
        return r2
      }
    }
  } catch { /* ignore */ }
  return res
}
