'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

const ICON = 'w-6 h-6'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// 모바일 하단 앱 내비게이션 — 홈 / 게임 / 만들기(중앙 강조) / 토너먼트 / MY
export default function MobileNav() {
  const pathname = usePathname()
  const { T } = useLang()

  // 관리자·스튜디오 화면에서는 숨김
  if (pathname.startsWith('/admin') || pathname.startsWith('/studio')) return null

  const item = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
        active ? 'text-[#2563eb]' : 'text-[#857a68]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
    </Link>
  )

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[65] bg-white/90 backdrop-blur-xl border-t border-[#ebe4d6] pb-[env(safe-area-inset-bottom)]"
      aria-label="mobile navigation"
    >
      <div className="flex items-stretch h-14">
        {item('/', T.nav.home, (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
        ), pathname === '/')}
        {item('/games', T.nav.games, (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><rect x="3" y="7" width="18" height="11" rx="3" /><path d="M8 11v4M6 13h4M15 12h.01M17.5 14h.01" /></svg>
        ), pathname.startsWith('/games'))}
        {/* 중앙 만들기 — 그라디언트 원형 강조 */}
        <Link href="/studio" className="flex flex-col items-center justify-center flex-1" aria-label={T.nav.studio}>
          {/* 큰 네모 점토 캐릭터 — 로고 그대로, 가끔 윙크 */}
          <span className="-mt-2 block w-12 h-12 drop-shadow-[0_6px_14px_rgba(240,90,40,0.45)] active:scale-95 transition-transform">
            <svg viewBox="0 0 32 32" className="w-full h-full" aria-hidden>
              <rect x="6.2" y="6.2" width="22" height="22" rx="6.5" fill="#b93d16" transform="rotate(-3 17.2 17.2)" />
              <rect x="4.5" y="4.5" width="22" height="22" rx="6.5" fill="#F05A28" transform="rotate(-3 15.5 15.5)" />
              <rect x="4.5" y="4.5" width="22" height="10" rx="6.5" fill="#ff8a5c" opacity="0.65" transform="rotate(-3 15.5 15.5)" />
              {/* 왼눈 — 평소 점, 가끔 윙크(곡선) */}
              <circle className="wink-open" cx="11.8" cy="15" r="1.9" fill="#161616" />
              <path className="wink-closed" d="M9.6 15.2q2.2 1.8 4.4 0" stroke="#161616" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <circle cx="19.8" cy="14.6" r="1.9" fill="#161616" />
              <path d="M13.4 20q2.3 2 4.6 0" stroke="#161616" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        </Link>
        {item('/tournament', T.nav.tournament, (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></svg>
        ), pathname.startsWith('/tournament'))}
        {item('/profile', T.nav.mypage, (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" /></svg>
        ), pathname.startsWith('/profile'))}
      </div>
    </nav>
  )
}
