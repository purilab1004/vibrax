import type { Metadata } from 'next'
import { Press_Start_2P } from 'next/font/google'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'
import NavBar from '@/components/NavBar'
import FooterLinks from '@/components/FooterLinks'
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
    default: 'Vibrexcup (Beta) — AI 바이브코딩 게임 플랫폼',
    template: '%s | Vibrexcup',
  },
  description:
    'Vibrexcup — 나만의 바이브 코딩으로 게임을 제작하고 공유하는 AI 게임 플랫폼. 자체 프롬프트 빌드로 프롬프트 한 줄이면 게임이 완성되고, AI DJ 스트리머 AJ가 게임을 재밌게 실시간 중계합니다. 광고주가 붙으면 AJ가 대신 광고까지 해주는 신개념 AI 서비스.',
  keywords: [
    'vibrexcup',
    '바이브렉스컵',
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
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티. 지금 바로 플레이하거나 직접 만든 게임을 등록하세요.',
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
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://vibrexcup.com',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
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
    alternateName: ['바이브렉스컵', 'VIBREXCUP'],
    url: 'https://vibrexcup.com',
    description:
      'Vibrexcup is an AI game platform: build and share your own games with vibe coding and the built-in prompt builder, while AJ — the AI DJ streamer — hosts gameplay live and can even run sponsored segments for advertisers.',
    publisher: {
      '@type': 'Organization',
      name: 'Vibrexcup',
      url: 'https://vibrexcup.com',
      email: 'dev@puritechlab.com',
    },
  }

  return (
    <html lang={lang} className={`${pressStart.variable} h-full`}>
<body className="bg-[#0a0a0a] text-white min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <LangProvider initialLang={lang}>
          <NavBar />
          <Suspense fallback={null}>
            <Sidebar newGenres={newGenres} channels={channels} tournament={tournament} />
          </Suspense>
          <main className="flex-1 md:pl-[var(--rail-w,14rem)] transition-[padding] duration-200">{children}</main>
          <footer className="border-t border-gray-800 py-6 px-6 mt-auto md:pl-[var(--rail-w,14rem)] transition-[padding] duration-200">
            <FooterLinks />
          </footer>
        </LangProvider>
      </body>
    </html>
  )
}
