'use client'

import Link from 'next/link'
import GameCard from '@/components/GameCard'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 넷플릭스식 가로 슬라이더 행 — 큰 카드가 한 줄에 2~3장만 보여 하나하나에 집중된다.
function Row({ heading, headerExtra, games, large }: {
  heading: React.ReactNode
  headerExtra?: React.ReactNode
  games: GameWithCreator[]
  large?: boolean
}) {
  if (games.length === 0) return null
  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5">
        {heading}
        {headerExtra}
      </div>
      <div className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-6 px-6 pb-2">
        {games.map(game => (
          <div
            key={game.id}
            className={`shrink-0 snap-start ${large ? 'w-[320px] sm:w-[420px] xl:w-[480px]' : 'w-[280px] sm:w-[360px] xl:w-[400px]'}`}
          >
            <GameCard
              game={game}
              creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
              creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
              creatorCountry={game.profiles?.country ?? null}
              bjAvatarConfig={game.profiles?.avatar_config ?? null}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function LiveGrid({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()

  const topLive = [...games]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 8)

  return (
    <div>
      <Row
        large
        heading={
          <h2 className="font-pixel text-sm text-white tracking-widest flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {T.games.liveNow}
          </h2>
        }
        games={topLive}
      />
      {GENRES.map(g => (
        <Row
          key={g}
          heading={
            <h2 className="font-pixel text-xs text-[#00ff41] tracking-widest">{T.genres[g]}</h2>
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
        />
      ))}
    </div>
  )
}
