'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'

// 좌측 고정 레일 — 홈 + 장르별 게임 카테고리. 기본은 아이콘만, 토글(☰)로 이름 노출.
// 데스크탑(md+) 전용. 모바일은 헤더 햄버거 메뉴가 내비를 담당.

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

export default function RightRail({ newGenres = [] }: { newGenres?: string[] }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const { T } = useLang()
  const [open, setOpen] = useState(false)

  const activeGenre = pathname === '/games' ? params.get('genre') : null
  const isHome = pathname === '/'

  const row = (active: boolean) =>
    `flex items-center h-11 transition-colors ${
      active ? 'text-[#00ff41] bg-[#00ff41]/10' : 'text-gray-300 hover:text-[#00ff41] hover:bg-white/5'
    }`
  // 아이콘은 접힌 폭(w-14)과 같은 고정 컬럼에 가운데 정렬 → 접힌 상태에서 중앙에 보임
  const iconCol = 'w-14 shrink-0 flex items-center justify-center'
  const label = `font-pixel text-[9px] tracking-widest whitespace-nowrap pr-3 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`

  return (
    <aside
      className={`hidden md:flex fixed top-14 left-0 bottom-0 z-40 flex-col overflow-hidden border-r border-gray-800 bg-[#0a0a0a]/95 backdrop-blur-sm transition-[width] duration-200 ${open ? 'w-44' : 'w-14'}`}
      aria-label="categories"
    >
      {/* 상단 메뉴 토글 — 카테고리명 노출 */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'collapse' : 'expand'}
        className="flex items-center h-12 shrink-0 border-b border-gray-800 text-gray-400 hover:text-[#00ff41] transition-colors"
      >
        <span className={iconCol}>
          {open ? (
            <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="m6 6 12 12M18 6 6 18" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className={ICON} {...stroke}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </span>
        <span className={label}>{T.nav.categories}</span>
      </button>

      <nav className="flex flex-col py-1">
        <Link href="/" className={row(isHome)} title={T.nav.home}>
          <span className={iconCol}><HomeIcon /></span>
          <span className={label}>{T.nav.home}</span>
        </Link>

        <div className="my-1 mx-3 border-t border-gray-800/70" />

        {GENRES.map(g => {
          const isNew = newGenres.includes(g)
          return (
            <Link key={g} href={`/games?genre=${g}`} className={row(activeGenre === g)} title={isNew ? `${T.genres[g]} (NEW)` : T.genres[g]}>
              <span className={`${iconCol} relative`}>
                {GENRE_ICON[g]}
                {isNew && <span className="absolute top-2 right-3.5 w-1.5 h-1.5 rounded-full bg-[#00ff41] ring-2 ring-[#0a0a0a]" />}
              </span>
              <span className={label}>{T.genres[g]}</span>
              {isNew && open && (
                <span className="font-pixel text-[7px] text-black bg-[#00ff41] px-1 py-px tracking-widest shrink-0">NEW</span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
