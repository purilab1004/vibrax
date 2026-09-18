'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import { useIsNativeApp } from '@/lib/isNativeApp'

const ICON = 'w-[26px] h-[26px]'

// 모바일 하단 앱 내비게이션 — 홈 / 게임 / 만들기(중앙 강조) / 토너먼트 / MY
export default function MobileNav() {
  const pathname = usePathname()
  const { T } = useLang()
  const isApp = useIsNativeApp()

  // 네이티브 앱에서는 RN 하단 탭바가 대신하므로 웹 내비는 숨김 (App.tsx 주입 CSS 와 이중 안전장치)
  if (isApp) return null
  // 관리자·스튜디오 화면에서는 숨김
  if (pathname.startsWith('/admin') || pathname.startsWith('/studio')) return null

  // 인스타그램식 — 글씨 없이 아이콘만, 선택되면 파란 채움 / 아닐 땐 연한 회색 외곽선
  const item = (href: string, label: string, icon: (active: boolean) => React.ReactNode, active: boolean) => (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      onClick={() => { if (href === '/') window.scrollTo({ top: 0, behavior: pathname === '/' ? 'smooth' : 'auto' }) }}
      className={`group flex items-center justify-center flex-1 h-full transition-colors active:scale-95 ${active ? 'text-[#2563eb]' : 'text-[#c7cbd4]'}`}
    >
      {icon(active)}
    </Link>
  )

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[65] bg-white/95 backdrop-blur-xl border-t border-[#f0f1f4] pb-[env(safe-area-inset-bottom)]"
      aria-label="mobile navigation"
    >
      <div className="flex items-stretch h-14">
        {item('/', T.nav.home, (on) => (
          <svg viewBox="0 0 24 24" className={ICON} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={on ? 1.4 : 1.9} strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 10.7 12 4.2l8 6.5v7.6a2 2 0 0 1-2 2h-3.2v-5.1a2.8 2.8 0 0 0-5.6 0v5.1H6a2 2 0 0 1-2-2z" />
          </svg>
        ), pathname === '/')}
        {item('/games', T.nav.games, (on) => (
          <svg viewBox="0 0 24 24" className={ICON} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={on ? 1.2 : 1.9} strokeLinejoin="round" strokeLinecap="round">
            <path d="M8.2 6.5h7.6a4.2 4.2 0 0 1 4.1 3.3l1 4.6a2.9 2.9 0 0 1-5.2 2.3l-1-1.3H9.3l-1 1.3A2.9 2.9 0 0 1 3.1 14.4l1-4.6a4.2 4.2 0 0 1 4.1-3.3Z" />
            <path d="M8.3 10.6v2.6M7 11.9h2.6" stroke={on ? '#fff' : 'currentColor'} strokeWidth={1.7} />
            <circle cx="15.6" cy="11.2" r={on ? 0.95 : 0.85} fill={on ? '#fff' : 'currentColor'} stroke="none" />
            <circle cx="17.4" cy="13.2" r={on ? 0.95 : 0.85} fill={on ? '#fff' : 'currentColor'} stroke="none" />
          </svg>
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
        {item('/tournament', T.nav.tournament, (on) => (
          <svg viewBox="0 0 24 24" className={ICON} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={on ? 1.3 : 1.9} strokeLinejoin="round" strokeLinecap="round">
            <path d="M7.5 4h9v5.2a4.5 4.5 0 0 1-9 0z" />
            <path d="M7.5 5.8H5.2a.8.8 0 0 0-.8.9c.2 1.8 1.4 3 3.1 3.2M16.5 5.8h2.3a.8.8 0 0 1 .8.9c-.2 1.8-1.4 3-3.1 3.2" fill="none" strokeWidth={1.8} />
            <path d="M12 13.7v3.1M8.6 20h6.8a2.6 2.6 0 0 0-2.6-3.2h-1.6A2.6 2.6 0 0 0 8.6 20Z" />
          </svg>
        ), pathname.startsWith('/tournament'))}
        {item('/profile', T.nav.mypage, (on) => (
          <svg viewBox="0 0 24 24" className={ICON} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={on ? 1.3 : 1.9} strokeLinejoin="round" strokeLinecap="round">
            <circle cx="12" cy="8.4" r="3.6" />
            <path d="M4.8 20c.9-3.9 3.7-6 7.2-6s6.3 2.1 7.2 6z" />
          </svg>
        ), pathname.startsWith('/profile'))}
      </div>
    </nav>
  )
}
