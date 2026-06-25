'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'

// 우측 고정 레일 — 홈 + 장르별 게임 카테고리. 기본은 아이콘만, 토글(☰)로 이름 노출.
// 데스크탑(lg+) 전용. 모바일은 헤더 햄버거 메뉴가 내비를 담당.

const ICON = 'w-5 h-5 shrink-0'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function HomeIcon() {
  return <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
}
const GENRE_ICON: Record<Genre, React.ReactNode> = {
  action: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>,
  adventure: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></svg>,
  strategy: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.6" /></svg>,
  sports: <svg viewBox="0 0 24 24" className={ICON} {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>,
}

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

export default function RightRail() {
  const pathname = usePathname()
  const params = useSearchParams()
  const { T } = useLang()
  const [open, setOpen] = useState(false)

  const activeGenre = pathname === '/games' ? params.get('genre') : null
  const isHome = pathname === '/'

  const row = (active: boolean) =>
    `flex items-center gap-3 h-11 px-3.5 transition-colors ${
      active ? 'text-[#00ff41] bg-[#00ff41]/10' : 'text-gray-300 hover:text-[#00ff41] hover:bg-white/5'
    }`
  const label = `font-pixel text-[9px] tracking-widest whitespace-nowrap transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`

  return (
    <aside
      className={`hidden md:flex fixed top-14 right-0 bottom-0 z-40 flex-col overflow-hidden border-l border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm transition-[width] duration-200 ${open ? 'w-44' : 'w-14'}`}
      aria-label="categories"
    >
      {/* 상단 우측 메뉴 토글 — 카테고리명 노출 */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'collapse' : 'expand'}
        className="flex items-center gap-3 h-12 px-3.5 shrink-0 border-b border-gray-800 text-gray-400 hover:text-[#00ff41] transition-colors"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="m6 6 12 12M18 6 6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
        <span className={label}>{T.nav.categories}</span>
      </button>

      <nav className="flex flex-col py-1">
        <Link href="/" className={row(isHome)} title={T.nav.home}>
          <HomeIcon />
          <span className={label}>{T.nav.home}</span>
        </Link>

        <div className="my-1 mx-3.5 border-t border-gray-800/70" />

        {GENRES.map(g => (
          <Link key={g} href={`/games?genre=${g}`} className={row(activeGenre === g)} title={T.genres[g]}>
            {GENRE_ICON[g]}
            <span className={label}>{T.genres[g]}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}
