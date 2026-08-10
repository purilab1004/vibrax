'use client'

import Link from 'next/link'
import GameCard from '@/components/GameCard'
import Reveal from '@/components/Reveal'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 핀터레스트 매소너리 — 카드마다 비율을 달리해 벽돌처럼 쌓인다 (id 기반으로 고정)
const ASPECTS = ['aspect-video', 'aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[4/3]', 'aspect-video', 'aspect-[3/4]'] as const

function aspectOf(id: string, i: number): string {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return ASPECTS[Math.abs(h + i) % ASPECTS.length]
}

export default function HomeMosaic({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()

  const sorted = [...games].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))

  return (
    <div>
      {/* 헤딩 — LIVE NOW */}
      <Reveal className="mb-6">
        <h2 className="font-pixel text-xl text-[#241f17] tracking-wide flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {T.games.liveNow}
        </h2>
      </Reveal>

      {/* 매소너리 그리드 — 열 단위로 벽돌처럼 쌓이고, 스크롤 진입 시 하나씩 올라오며 등장 */}
      <div className="columns-2 md:columns-3 xl:columns-4 gap-4">
        {/* 리딩 CTA — 다음 게임의 주인공 */}
        <Reveal delay={80} className="mb-4 break-inside-avoid">
          <Link
            href="/studio"
            className="group flex flex-col items-center justify-center gap-3 aspect-[4/5] w-full rounded-xl border-2 border-dashed border-[#cfc4ab] bg-white/60 hover:border-[#2563eb] hover:bg-white transition-colors"
          >
            <span className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] flex items-center justify-center shadow-[0_6px_20px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-sm md:text-base font-bold text-[#4a4337] group-hover:text-[#2563eb] transition-colors text-center px-4">
              {T.games.beNextHero}
            </span>
          </Link>
        </Reveal>

        {sorted.map((game, i) => (
          <Reveal key={game.id} delay={(i % 4) * 80} className="mb-4 break-inside-avoid">
            <GameCard
              variant="tile"
              aspectClass={aspectOf(game.id, i)}
              game={game}
              creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
              creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
              creatorCountry={game.profiles?.country ?? null}
              bjAvatarConfig={game.profiles?.avatar_config ?? null}
            />
          </Reveal>
        ))}
      </div>
    </div>
  )
}
