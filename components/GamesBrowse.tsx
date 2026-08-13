'use client'

import GameCard from '@/components/GameCard'
import FeedScreen from '@/components/home/FeedScreen'
import Reveal from '@/components/Reveal'
import type { GameWithCreator } from '@/lib/supabase/types'

// 홈과 같은 매소너리 리듬 — 정사각 이상 비율만 (id 기반 고정)
const ASPECTS = ['aspect-square', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[5/6]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/4]'] as const

function aspectOf(id: string, i: number): string {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return ASPECTS[Math.abs(h + i) % ASPECTS.length]
}

// 게임 목록 — 모바일: 쇼츠 스와이프 피드 / 데스크톱: 오로라 카드 매소너리
export default function GamesBrowse({ games }: { games: GameWithCreator[] }) {
  return (
    <div>
      {/* 모바일: 한 화면 한 게임, 스와이프로 다음 */}
      <div className="md:hidden">
        {games.map(game => (
          <FeedScreen key={game.id} game={game} />
        ))}
      </div>

      {/* 데스크톱: 매소너리 */}
      <div className="hidden md:block columns-2 lg:columns-3 2xl:columns-4 gap-5">
        {games.map((game, i) => (
          <Reveal key={game.id} delay={(i % 4) * 80} className="mb-5 break-inside-avoid">
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
