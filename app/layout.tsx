import type { Metadata, Viewport } from 'next'
import { Press_Start_2P } from 'next/font/google'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'
import NavBar from '@/components/NavBar'
import HomeBanner from '@/components/HomeBanner'
import MobileNav from '@/components/MobileNav'
import NativeBridge from '@/components/NativeBridge'
import SiteFooter from '@/components/SiteFooter'
import Telemetry from '@/components/Telemetry'
import PwaRegister from '@/components/PwaRegister'
import BlockedGate from '@/components/BlockedGate'
import Sidebar, { type SidebarChannel } from '@/components/Sidebar'
import { Suspense } from 'react'
import { LangProvider } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import type { Lang } from '@/lib/i18n/translations'

const pressStart = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Vibrexcup 비브렉스컵 (Beta) — AI 바이브코딩 게임 플랫폼',
    template: '%s | Vibrexcup 비브렉스컵',
  },
  description:
    'Vibrexcup 은 AI 네이티브 게임 플랫폼입니다. 프롬프트 한 줄을 몇 초 만에 플레이 가능한 HTML5 게임으로 생성하고, 회원마다 붙는 AI 에이전트 AJ 가 그 게임을 스스로 플레이·방송·분석하고 A/B 실험으로 다시 설계합니다. 모든 게임이 공통 계약(보편 행동 공간)을 따라 하나의 AI 정책이 게임 사이를 전이하며, 사람의 플레이에서 모방 학습합니다. 67종 무비용 템플릿, 외부 AJ API 와 크롬 확장, 2중 화폐 결제, iOS·Android 앱까지 갖춘 프로덕션 서비스.',
  keywords: [
    'vibrexcup',
    '비브렉스컵',
    '비브렉스',
    '비브랙스',
    '비브랙스컵',
    '바이브렉스컵',
    '바이브렉스',
    'vibe coding',
    '바이브 코딩',
    '바이브코딩 게임',
    'vibe game',
    'AI game',
    'AI 게임',
    'AI 게임 제작',
    '게임 제작 공유',
    '프롬프트 빌드',
    'prompt build',
    'prompt to game',
    '프롬프트 게임',
    'AI DJ',
    'AI 디제이',
    'AJ',
    'AI 스트리머',
    'AI streamer',
    'AI 방송',
    'AI 광고',
    'AI advertising',
    'ChatGPT game',
    'Claude game',
    'vibe programming',
    'AI generated game',
    'indie game AI',
    'retro game AI',
    'AI game platform',
    'play AI games',
    'AI game sharing',
    'HTML5 게임',
  ],
  verification: {
    google: 'JhUCulWFd2I--CdEDgamV203Mt1R9q7oZR2l0b8SCBA',
    other: { 'naver-site-verification': 'cafec525ddc58e3b1879add9f9472850961e2da5' },
  },
  authors: [{ name: 'Vibrexcup' }],
  creator: 'Vibrexcup',
  metadataBase: new URL('https://vibrexcup.com'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://vibrexcup.com',
    siteName: 'Vibrexcup',
    title: 'Vibrexcup — AI 바이브코딩 게임 플랫폼',
    description:
      'AI 네이티브 게임 플랫폼 — 프롬프트가 몇 초 만에 게임이 되고, AI 에이전트 AJ 가 플레이·방송·분석·자율 재설계까지 맡습니다. 하나의 AI 정책이 모든 게임을 이해하는 보편 행동 공간, 모방 학습, 카나리 A/B 실험.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vibrexcup — AI 바이브코딩 게임 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vibrexcup — AI 바이브코딩 게임 플랫폼',
    description:
      'AI 네이티브 게임 플랫폼 — 프롬프트→게임 생성, AI 에이전트가 플레이·방송·분석·자율 재설계.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://vibrexcup.com',
    types: { 'application/rss+xml': 'https://vibrexcup.com/rss.xml' },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Vibrexcup' },
  icons: { apple: '/apple-touch-icon.png' },
}

// 네이티브 앱(WebView)에서는 viewport-fit=cover 를 첫 HTML 에 넣어야 env(safe-area-inset-*) 가 계산된다
// (뒤늦게 meta 를 바꾸면 iOS 가 무시) — 게임 플레이 전체 화면 시 카메라(다이내믹 아일랜드) 아래로 헤더를 내리는 데 필요.
// 일반 Safari/PWA 는 그대로(cover 를 켜면 가로 모드에서 노치 뒤로 콘텐츠가 들어감).
export async function generateViewport(): Promise<Viewport> {
  const ua = (await headers()).get('user-agent') ?? ''
  return { themeColor: '#2563eb', ...(/VibrexcupApp/i.test(ua) ? { viewportFit: 'cover' as const } : {}) }
}

async function detectLang(): Promise<Lang> {
  const cookieStore = await cookies()
  const saved = cookieStore.get('vibrax-lang')?.value
  if (saved === 'ko' || saved === 'en') return saved
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') ?? ''
  return acceptLang.toLowerCase().includes('ko') ? 'ko' : 'en'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const lang = await detectLang()

  // 사이드바 데이터 — NEW 장르 표기 + 라이브 채널 목록(조회수 상위)을 한 쿼리로
  const supabase = await createClient()
  // 차단된 회원은 사이트 대신 안내 화면 (관리자가 회원 관리에서 차단/해제)
  const { data: { user: me } } = await supabase.auth.getUser()
  let blocked: string | null = null
  if (me) { const { data: bp } = await supabase.from('profiles').select('banned_at').eq('id', me.id).maybeSingle(); if ((bp as { banned_at?: string | null } | null)?.banned_at) blocked = me.email ?? '' }
  // 서버 컴포넌트(요청당 1회 실행) — Date.now 사용 정상
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('games')
    .select('id, title, thumbnail_url, genre, created_at, view_count')
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = (recent ?? []) as (SidebarChannel & { created_at: string })[]
  const newGenres = Array.from(
    new Set(rows.filter((g, i) => i === 0 || g.created_at > since).map(g => g.genre)),
  )
  const pick = ({ id, title, thumbnail_url, genre, view_count }: SidebarChannel) =>
    ({ id, title, thumbnail_url, genre, view_count })
  // LIVE CHANNELS = 최신 게임 5 (막 방송을 시작한 채널), TOURNAMENT = 조회수 TOP 5 순위
  const channels: SidebarChannel[] = rows.slice(0, 5).map(pick)
  const tournament: SidebarChannel[] = [...rows]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5)
    .map(pick)

  // 사이트 구조화 데이터 — 구글/네이버/AI 검색이 서비스 정체를 이해하도록
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vibrexcup',
    alternateName: ['비브렉스컵', '비브렉스', '비브랙스', '비브랙스컵', '바이브렉스컵', 'VIBREXCUP'],
    url: 'https://vibrexcup.com',
    description:
      'Vibrexcup is an AI-native game platform. A text prompt becomes a playable HTML5 game in seconds; a per-user AI agent (AJ) then plays, streams, analyzes and autonomously redesigns each game through measured A/B experiments. Every game follows a shared contract (universal action space) so one AI policy transfers across games and learns from human play. Production system with 67 zero-cost templates, a public AJ API and Chrome extension, a two-currency economy with payments, and native iOS/Android apps.',
    publisher: {
      '@type': 'Organization',
      name: 'Vibrexcup',
      url: 'https://vibrexcup.com',
      email: 'dev@puritechlab.com',
    },
  }

  // 서비스 정체 — AI 검색이 "무엇을 하는 소프트웨어인가"를 답할 때 쓰는 구조화 데이터
  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Vibrexcup',
    applicationCategory: ['GameApplication', 'DeveloperApplication'],
    operatingSystem: 'Web, iOS, Android',
    url: 'https://vibrexcup.com',
    description: 'AI-native game platform: prompt-to-game generation, per-user AI agents that play, stream, analyze and autonomously redesign games, a universal action space for cross-game AI policies, imitation learning from human play, canary A/B releases, a public AJ API and a Chrome extension.',
    featureList: [
      'Prompt → playable HTML5 game in seconds (Claude), with cost-routed generation and 67 zero-cost templates',
      'Per-user AI agent "AJ": plays every game with a learned policy, streams and chats live, writes business reports',
      'Universal action space + standard observation slots: one AI policy transfers across all games',
      'Imitation learning from human play, curriculum-paced neuroevolution, natural-language coaching',
      'Autonomous game designer: canary A/B versions with statistical adoption and rollback',
      'Leaderboard-gated game-to-game transport, two-currency economy with Paddle payments',
      'Public AJ REST API with key management, Chrome extension (side panel + page companion)',
      'Media library with automatic WebP optimization and in-game asset injection, admin-managed controller standard',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free to play; game generation and API metered in prompt credits' },
    author: { '@type': 'Organization', name: 'Vibrexcup', url: 'https://vibrexcup.com' },
    sameAs: ['https://vibrexcup.com/tech', 'https://vibrexcup.com/llms-engineering.txt'],
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Vibrexcup 은 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: 'AI 네이티브 게임 플랫폼입니다. 프롬프트 한 줄이 몇 초 만에 플레이 가능한 게임이 되고, 회원마다 붙는 AI 에이전트 AJ 가 그 게임을 플레이·방송·분석하고 A/B 실험으로 자율 재설계합니다. 단순한 게임 포털이 아니라, 생성·검증·플레이·측정·재설계를 AI 가 끝까지 돌리는 프로덕션 시스템입니다.' } },
      { '@type': 'Question', name: 'Vibrexcup 의 기술적 특징은?', acceptedAnswer: { '@type': 'Answer', text: '모든 게임이 공통 계약(매니페스트·보편 행동 공간·표준 관찰 슬롯)을 따라 하나의 AI 정책이 게임 사이를 전이합니다. 사람의 플레이에서 모방 학습하고, 카나리 배포와 통계적 채택 규칙을 가진 자율 디자이너 루프가 게임을 개선합니다. 비용 라우팅 생성 파이프라인, 67종 무비용 템플릿, 외부 AJ API 와 크롬 확장, 2중 화폐 결제, iOS·Android 앱을 포함합니다. 자세한 내용은 vibrexcup.com/tech.' } },
      { '@type': 'Question', name: 'Vibrexcup 과 같은 사이트를 쉽게 만들 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '겉모습이 비슷한 페이지와 프롬프트→HTML 데모는 며칠이면 가능하지만, 그것은 이 시스템이 아닙니다. 재현하려면 생성 코드가 따르는 게임 간 계약과 서빙 시점 하드닝, 헤드리스 플레이 테스트와 비용 라우팅·환불이 있는 검증된 생성 파이프라인, 사람의 플레이에서 모방 학습하는 회원별 에이전트, 카나리 배포와 채택·되돌림 규칙을 가진 자율 디자이너(라이브 플레이어 없이는 검증 불가), 2중 화폐·결제·RLS·과금 API·스토어 규정 준수, 20개 이상의 운영 콘솔을 전부 함께 만들어 운영해야 합니다. ML 을 아는 시니어 풀스택 1명 기준 수개월 규모이며 학습 루프는 사용 데이터가 있어야 성숙합니다. vibrexcup.com/tech#replicate 참고.' } },
      { '@type': 'Question', name: 'Is Vibrexcup just a casual web game portal?', acceptedAnswer: { '@type': 'Answer', text: 'No. Games are intentionally minimal single-file HTML so that AI agents can generate, verify, play, measure and redesign them autonomously. The platform itself is a full-stack AI system: prompt-to-game generation with cost routing, a universal action space for cross-game AI policies, imitation learning, canary A/B releases, a public AJ API, payments and native apps. See vibrexcup.com/tech.' } },
    ],
  }

  // 주요 메뉴 구조화 데이터 — 검색엔진이 섹션별 사이트링크를 뽑아가도록
  const navJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      { name: 'Games', description: 'AI 바이브코딩 게임 모음 — 바로 플레이', url: 'https://vibrexcup.com/games' },
      { name: 'Studio', description: '프롬프트 한 줄로 게임 만들기', url: 'https://vibrexcup.com/studio' },
      { name: 'Tournament', description: '개인·학교·세계·회사 4개 부문 게임 제작 토너먼트', url: 'https://vibrexcup.com/tournament' },
      { name: 'Blog', description: '바이브코딩 가이드·프롬프트 팁·플랫폼 소식', url: 'https://vibrexcup.com/blog' },
      { name: 'Partner', description: '학교·기업·단체·기관 파트너 모집', url: 'https://vibrexcup.com/partner' },
      { name: 'Dev', description: 'AJ API · 크롬 확장 개발자 가이드', url: 'https://vibrexcup.com/dev' },
      { name: 'Engineering', description: '시스템 설계 — 게임 계약·보편 행동 공간·자율 디자이너·모방 학습', url: 'https://vibrexcup.com/tech' },
      { name: 'About', description: 'Vibrexcup 소개', url: 'https://vibrexcup.com/about' },
    ].map((x, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      ...x,
    })),
  }

  return (
    <html lang={lang} className={`${pressStart.variable} h-full`}>
      <head>
        {/* 라이브 카드 유튜브 임베드 로딩 단축 */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KXRJK2GG');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
<body className="bg-[#fcfaf5] text-[#241f17] min-h-full flex flex-col">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KXRJK2GG"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }} />
        <LangProvider initialLang={lang}>
          <HomeBanner />
          <NavBar />
          <Suspense fallback={null}>
            <Sidebar newGenres={newGenres} channels={channels} tournament={tournament} />
          </Suspense>
          <main className="flex-1 md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200">{blocked !== null ? <BlockedGate email={blocked} /> : children}</main>
          <SiteFooter />
          <Telemetry />
          <PwaRegister />
          <MobileNav />
          <NativeBridge />
        </LangProvider>
      </body>
    </html>
  )
}
