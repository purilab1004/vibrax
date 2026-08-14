'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'

const GENRES: { key: Genre | ''; label: string }[] = [
  { key: '', label: 'ALL' },
  { key: 'action', label: 'ACTION' },
  { key: 'adventure', label: 'ADVENTURE' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'sports', label: 'SPORTS' },
]

// /games 좌측 사이드바 — 카테고리 목록 + 이어서 사이트 메뉴 (틱톡 사이드 문법)
export default function GenreSidebar() {
  const searchParams = useSearchParams()
  const current = searchParams.get('genre') ?? ''
  const { T } = useLang()

  const menu: [string, string][] = [
    ['/', T.nav.home],
    ['/studio', T.nav.studio],
    ['/tournament', `🏆 ${T.nav.tournament}`],
    ['/blog', T.nav.blog],
    ['/partner', T.nav.partner],
    ['/about', T.nav.about],
  ]

  return (
    <nav className="flex flex-col" aria-label="genres and menu">
      <p className="font-pixel text-[10px] text-[#9d9280] tracking-[0.25em] px-3 mb-2">CATEGORY</p>
      {GENRES.map(({ key, label }) => (
        <Link
          key={key || 'all'}
          href={key ? `/games?genre=${key}` : '/games'}
          className={`px-3 py-2.5 rounded-lg text-[14px] font-bold tracking-wide transition-colors ${
            current === key
              ? 'text-[#2563eb] bg-[#2563eb]/10'
              : 'text-[#4a4337] hover:text-[#2563eb] hover:bg-[#241f17]/5'
          }`}
        >
          {label}
        </Link>
      ))}

      <div className="my-4 border-t border-[#ebe4d6]" />

      <p className="font-pixel text-[10px] text-[#9d9280] tracking-[0.25em] px-3 mb-2">MENU</p>
      {menu.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="px-3 py-2 rounded-lg text-[13px] font-medium text-[#6b6152] hover:text-[#2563eb] hover:bg-[#241f17]/5 transition-colors"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
