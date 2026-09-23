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
  // 앱(iOS/Android) 로그인 — 시스템 브라우저(ASWebAuthenticationSession·Custom Tabs)에서 여기로 돌아오면 코드를 교환하지 않고
  // 앱 스킴(vibrexcup://auth)으로 넘긴다 → 앱이 브라우저를 닫고 웹뷰에서 이 콜백을 다시 불러 세션을 만든다(PKCE verifier 가 웹뷰 쿠키에 있음).
  // 예전엔 redirectTo 를 vibrexcup:// 로 직접 줬는데 Supabase 허용 목록에 없으면 사이트 홈으로 떨어져 로그인이 안 됐다.
  if (url.searchParams.get('app') === '1') {
    const deep = `vibrexcup://auth?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNext)}`
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vibrexcup</title><meta http-equiv="refresh" content="0;url=${deep}"></head><body style="margin:0;font-family:-apple-system,system-ui,sans-serif;background:#fcfaf5;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="text-align:center;padding:24px"><p style="font-size:16px;font-weight:700;color:#241f17">로그인 완료 — 앱으로 돌아가는 중…</p><a href="${deep}" style="display:inline-block;margin-top:14px;padding:12px 22px;border-radius:999px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none">앱으로 돌아가기</a></div><script>location.replace(${JSON.stringify(deep)})</script></body></html>`
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
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
