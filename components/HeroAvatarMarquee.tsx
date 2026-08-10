'use client'

import Link from 'next/link'
import { topCreatorsOf } from '@/lib/creators'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 상위 3위 순위 색 — 금/은/동
const RANK_COLOR = ['text-[#c9940c]', 'text-gray-400', 'text-amber-600'] as const

// 히어로 하단 TOP AI AVATAR 마퀴 — linearity.io 로고 스트립처럼 유리 반투명 칩이 매끄럽게 흐른다
export default function HeroAvatarMarquee({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const creators = topCreatorsOf(games)
  if (creators.length === 0) return null

  return (
    <div className="w-full">
      <p className="text-center font-pixel text-[11px] tracking-[0.25em] text-[#c9940c] mb-4">
        🏆 {T.games.topCreators}
      </p>
      <div className="hero-marquee relative overflow-hidden">
        {/* 동일한 리스트 두 벌 — 각 벌의 폭이 같아야 -50% 이동이 끊김 없이 이어진다 */}
        <div className="hero-marquee-track flex w-max will-change-transform">
          {[0, 1].map(copy => (
            <div key={copy} className="flex items-center gap-4 pr-4" aria-hidden={copy === 1}>
              {creators.map((cr, i) => (
                <Link
                  key={`${cr.id}-${copy}`}
                  href={`/games?creator=${cr.id}`}
                  tabIndex={copy === 1 ? -1 : undefined}
                  className="shrink-0 flex items-center gap-2 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-[0_2px_10px_rgba(36,31,23,0.05)] px-5 py-2 whitespace-nowrap hover:bg-white/70 transition-colors group/creator"
                >
                  {i < 3 && (
                    <span className={`font-pixel text-[9px] ${RANK_COLOR[i]}`}>#{i + 1}</span>
                  )}
                  <span className="text-[13px] font-semibold text-[#6b6152] group-hover/creator:text-[#2563eb] transition-colors">
                    {cr.name}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        {/* 양끝 페이드 */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#fcfaf5] to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#fcfaf5] to-transparent" aria-hidden />
      </div>
    </div>
  )
}
