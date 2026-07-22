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
    default: 'Vibrexcup — AI 바이브코딩 게임 플랫폼',
    template: '%s | Vibrexcup',
  },
  description:
    'AI로 만든 게임을 공유하는 바이브코딩 플랫폼. Claude, ChatGPT로 만든 액션, 어드벤처, 전략, 스포츠 게임을 즐기고 등록하세요. Vibe coding, AI game, vibe programming 커뮤니티.',
  keywords: [
    'vibe coding',
    'vibe game',
    'AI game',
    'vibe programming',
    'AI coding game',
    'ChatGPT game',
    'Claude game',
    'AI 게임',
    'AI 바이브코딩',
    '바이브코딩 게임',
    'vibe code',
    'AI generated game',
    'cursor game',
    'windsurf game',
    'indie game AI',
    'retro game AI',
    'AI game platform',
    'play AI games',
    'AI game sharing',
  ],
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

  return (
    <html lang={lang} className={`${pressStart.variable} h-full`}>
<body className="bg-[#0a0a0a] text-white min-h-full flex flex-col">
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
