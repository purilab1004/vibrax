import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// LLM 학습·브라우징 봇 서버 차원 차단 — robots.txt를 무시해도 403으로 강제.
// 검색 인덱서(Googlebot/Yeti/OAI-SearchBot/Claude-SearchBot/PerplexityBot)는 여기 없음 = 허용.
const AI_BLOCK_UA =
  /GPTBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-Web|anthropic-ai|Google-Extended|CCBot|Bytespider|meta-externalagent|cohere-ai|Perplexity-User|Diffbot|Google-CloudVertexBot|GoogleOther|Amazonbot|omgili|TimpiBot|YouBot|AI2Bot|img2dataset/i

export async function proxy(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  if (AI_BLOCK_UA.test(ua)) {
    return new NextResponse('Forbidden', { status: 403 })
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
