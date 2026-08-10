'use client'

import Link from 'next/link'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { topCreatorsOf } from '@/lib/creators'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 순위 강조 — 금/은/동 링과 배지
const RANK_STYLE = [
  { ring: 'ring-2 ring-[#c9940c]', badge: 'bg-[#c9940c] text-white' },
  { ring: 'ring-2 ring-gray-300', badge: 'bg-gray-300 text-black' },
  { ring: 'ring-2 ring-amber-600', badge: 'bg-amber-600 text-white' },
] as const

// 히어로 하단 TOP AI AVATAR 무한 마퀴 — linearity.io의 로고 스트립 자리
export default function HeroAvatarMarquee({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const creators = topCreatorsOf(games)
  if (creators.length === 0) return null

  // 끊김 없는 루프를 위해 두 번 이어 붙이고 -50% 이동
  const loop = [...creators, ...creators]

  return (
    <div className="w-full">
      <p className="text-center font-pixel text-[11px] tracking-[0.25em] text-[#c9940c] mb-4">
        🏆 {T.games.topCreators}
      </p>
      <div className="hero-marquee relative overflow-hidden">
        <div className="hero-marquee-track flex items-center gap-3 w-max">
          {loop.map((cr, i) => {
            const rank = RANK_STYLE[i % creators.length]
            return (
              <Link
                key={`${cr.id}-${i}`}
                href={`/games?creator=${cr.id}`}
                className="shrink-0 flex items-center gap-2.5 bg-white/80 backdrop-blur-sm border border-[#ebe4d6] hover:border-[#2563eb] rounded-full pl-1.5 pr-4 py-1.5 transition-colors group/creator"
              >
                <span className={`relative w-9 h-9 rounded-full overflow-hidden bg-white shrink-0 ${rank ? rank.ring : 'border border-[#ddd3bf]'}`}>
                  {cr.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cr.avatarUrl}
                      alt={cr.name}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: '50% 8%', transform: 'scale(2.1)', transformOrigin: '50% 14%' }}
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center font-pixel text-sm text-[#b3a78f]">
                      {cr.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {rank && (
                    <span className={`font-pixel text-[8px] px-1 py-0.5 rounded ${rank.badge}`}>#{(i % creators.length) + 1}</span>
                  )}
                  <span className="text-[13px] font-bold text-[#241f17] group-hover/creator:text-[#2563eb] transition-colors">{cr.name}</span>
                  <span className="text-[11px] text-[#857a68] flex items-center gap-1">
                    <ViewerIcon className="w-3 h-3" />
                    {formatViewers(cr.views)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
        {/* 양끝 페이드 */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#fcfaf5] to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#fcfaf5] to-transparent" aria-hidden />
      </div>
    </div>
  )
}
