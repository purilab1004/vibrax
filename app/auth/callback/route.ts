// OAuth / 매직링크 콜백 — code 를 세션으로 교환하고 next 로 이동.
// 세션 쿠키를 리다이렉트 응답에 직접 실어 보낸다 (Route Handler 에서 cookies() 만으로는 누락될 수 있음).
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback]', error.message)
    return NextResponse.redirect(new URL(`/login?error=oauth&redirect=${encodeURIComponent(safeNext)}`, url.origin))
  }
  return res
}
