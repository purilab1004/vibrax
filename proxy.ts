import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// LLM 학습·브라우징 봇 서버 차원 차단 — robots.txt를 무시해도 403으로 강제.
// 검색 인덱서(Googlebot/Yeti/OAI-SearchBot/Claude-SearchBot/PerplexityBot)는 여기 없음 = 허용.
const AI_BLOCK_UA =
  /GPTBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-Web|anthropic-ai|Google-Extended|CCBot|Bytespider|meta-externalagent|cohere-ai|Perplexity-User|Diffbot|Google-CloudVertexBot|GoogleOther|Amazonbot|omgili|TimpiBot|YouBot|AI2Bot|img2dataset/i

// ── 점검 모드 — 허용 IP만 접속, 나머지는 점검 페이지 ──
// 끄려면 MAINTENANCE_MODE를 false로 바꾸고 배포
const MAINTENANCE_MODE = false
const ALLOWED_IPS = ['222.111.202.123', '73.74.84.143', '106.101.139.192']

function clientIp(request: NextRequest): string {
  // x-real-ip는 Vercel 엣지가 실제 접속 IP로 설정 — 클라이언트가 위조 불가.
  // (x-forwarded-for의 첫 항목은 위조 가능하므로 신뢰하지 않는다)
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  const xff = request.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : ''
}

export async function proxy(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  if (AI_BLOCK_UA.test(ua)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 점검 모드 — 허용 IP 외에는 전부 점검 페이지로 rewrite (URL은 유지)
  if (MAINTENANCE_MODE && process.env.NODE_ENV !== 'development') {
    const { pathname } = request.nextUrl
    const exempt =
      pathname === '/maintenance' ||
      pathname.startsWith('/api/webhooks') ||   // 결제 웹훅은 살려둔다
      pathname.startsWith('/_next') ||
      pathname === '/icon.svg'
    if (!exempt && !ALLOWED_IPS.includes(clientIp(request))) {
      const url = request.nextUrl.clone()
      url.pathname = '/maintenance'
      return NextResponse.rewrite(url, { status: 503 })
    }
  }

  // /submit 로그인 게이트 — 세션 쿠키 갱신 포함 (기존 동작 유지)
  if (request.nextUrl.pathname.startsWith('/submit')) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', '/submit')
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  return NextResponse.next()
}

export const config = {
  // robots.txt·llms.txt는 차단 대상 봇도 읽을 수 있어야 disallow 규칙을 보고 물러간다
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|llms\\.txt).*)'],
}
