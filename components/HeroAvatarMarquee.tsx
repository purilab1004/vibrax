'use client'

import Link from 'next/link'
import { topCreatorsOf } from '@/lib/creators'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 상위 3위 순위 색 — 금/은/동
const RANK_COLOR = ['text-[#c9940c]', 'text-gray-400', 'text-amber-600'] as const

// 히어로 하단 TOP AI AVATAR — linearity 로고 스트립처럼 중앙에서만 보이고 양옆으로 자연스럽게 사라진다
export default function HeroAvatarMarquee({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const creators = topCreatorsOf(games)
  if (creators.length === 0) return null

  return (
    <div className="w-full">
      <p className="text-center font-pixel text-[11px] tracking-[0.25em] text-[#c9940c] mb-4">
        🏆 {T.games.topCreators}
      </p>
      {/* 중앙 폭 제한 + 마스크 페이드 — 항목이 중앙 구간에서만 보인다 */}
      <div className="hero-marquee relative overflow-hidden max-w-xl md:max-w-3xl mx-auto">
        {/* 동일한 리스트 두 벌 — 각 벌의 폭이 같아야 -50% 이동이 끊김 없이 이어진다 */}
        <div className="hero-marquee-track flex w-max will-change-transform">
          {[0, 1].map(copy => (
            <div key={copy} className="flex items-center gap-10 pr-10" aria-hidden={copy === 1}>
              {creators.map((cr, i) => (
                <Link
                  key={`${cr.id}-${copy}`}
                  href={`/games?creator=${cr.id}`}
                  tabIndex={copy === 1 ? -1 : undefined}
                  className="shrink-0 flex items-baseline gap-1.5 whitespace-nowrap group/creator"
                >
                  {i < 3 && (
                    <span className={`font-pixel text-[9px] ${RANK_COLOR[i]}`}>#{i + 1}</span>
                  )}
                  <span className="text-[15px] md:text-base font-bold text-[#9d9280] group-hover/creator:text-[#2563eb] transition-colors">
                    {cr.name}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
