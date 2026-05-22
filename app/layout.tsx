import type { Metadata } from 'next'
import { Press_Start_2P } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'
import { LangProvider } from '@/lib/i18n/context'
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
    default: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    template: '%s | Vibrax',
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
  authors: [{ name: 'Vibrax' }],
  creator: 'Vibrax',
  metadataBase: new URL('https://vibrax-rho.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://vibrax-rho.vercel.app',
    siteName: 'Vibrax',
    title: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    description:
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티. 지금 바로 플레이하거나 직접 만든 게임을 등록하세요.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vibrax — AI 바이브코딩 게임 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vibrax — AI 바이브코딩 게임 플랫폼',
    description:
      'Claude, ChatGPT 등 AI로 만든 게임을 공유하는 바이브코딩 커뮤니티.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://vibrax-rho.vercel.app',
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
  return (
    <html lang={lang} className={`${pressStart.variable} h-full`}>
      <body className="bg-[#0a0a0a] text-white min-h-full flex flex-col">
        <LangProvider initialLang={lang}>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-800 py-6 px-6 mt-auto">
            <FooterCopyright />
          </footer>
        </LangProvider>
      </body>
    </html>
  )
}

function FooterCopyright() {
  return (
    <p className="text-center font-pixel text-[9px] text-gray-500 tracking-widest">
      © VIBE GAME 2026 PURILAB
    </p>
  )
}
