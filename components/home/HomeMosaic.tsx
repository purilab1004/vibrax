'use client'

import Link from 'next/link'
import GameCard from '@/components/GameCard'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 유튜브식 홈 — 슬라이더 대신 오른쪽 끝까지 꽉 차는 그리드. 섹션별로 행이 줄바꿈된다.
function Section({ heading, headerExtra, games, limit }: {
  heading: React.ReactNode
  headerExtra?: React.ReactNode
  games: GameWithCreator[]
  limit: number
}) {
  if (games.length === 0) return null
  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-5 gap-3">
        {heading}
        {headerExtra}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
        {games.slice(0, limit).map(game => (
          <GameCard
            key={game.id}
            variant="tile"
            game={game}
            creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
            creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
            creatorCountry={game.profiles?.country ?? null}
            bjAvatarConfig={game.profiles?.avatar_config ?? null}
          />
        ))}
      </div>
    </section>
  )
}

export default function HomeMosaic({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()

  const topLive = [...games]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 8)

  return (
    <div>
      <Section
        heading={
          <h2 className="font-pixel text-sm text-white tracking-widest flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {T.games.liveNow}
          </h2>
        }
        games={topLive}
        limit={8}
      />
      {GENRES.map(g => (
        <Section
          key={g}
          heading={
            <h2 className="font-pixel text-sm text-[#00ff41] tracking-widest">{T.genres[g]}</h2>
          }
          headerExtra={
            <Link
              href={`/games?genre=${g}`}
              className="text-[13px] text-gray-400 hover:text-[#00ff41] transition-colors tracking-wider"
            >
              {T.games.viewAll}
            </Link>
          }
          games={games.filter(x => x.genre === g)}
          limit={4}
        />
      ))}
    </div>
  )
}
