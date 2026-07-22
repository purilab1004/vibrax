import { createClient } from '@/lib/supabase/server'
import GameCard from '@/components/GameCard'
import GenreFilter from '@/components/GenreFilter'
import { Suspense } from 'react'
import type { Genre, GameWithCreator } from '@/lib/supabase/types'
import { selectGamesWithCreator } from '@/lib/supabase/games'

const VALID_GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

interface Props {
  searchParams: Promise<{ genre?: string; q?: string }>
}

async function GameGrid({ genre, q }: { genre?: string; q?: string }) {
  const supabase = await createClient()
  const validGenre = VALID_GENRES.includes(genre as Genre) ? (genre as Genre) : undefined
  const term = q?.trim()

  const games = await selectGamesWithCreator<GameWithCreator[]>(supabase, query => {
    let x = query.order('created_at', { ascending: false })
    if (validGenre) x = x.eq('genre', validGenre)
    if (term) x = x.ilike('title', `%${term}%`)
    return x
  })

  if (!games || games.length === 0) {
    return (
      <p className="text-center text-gray-300 text-sm py-24">
        {term
          ? `"${term}" 검색 결과가 없습니다.`
          : validGenre ? `${validGenre.toUpperCase()} 장르의 게임이 없습니다.` : '아직 등록된 게임이 없습니다.'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-x-6 gap-y-12">
      {games.map(game => (
        <GameCard
          key={game.id}
          game={game}
          creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
          creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
          creatorCountry={game.profiles?.country ?? null}
          bjAvatarConfig={game.profiles?.avatar_config ?? null}
        />
      ))}
    </div>
  )
}

export default async function GamesPage({ searchParams }: Props) {
  const { genre, q } = await searchParams
  const term = q?.trim()

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">GAMES</h1>
        <span className="text-xs text-gray-300">
          {term ? `🔍 "${term}"` : 'AI 바이브코딩 게임 모음'}
        </span>
      </div>
      <div className="mb-8">
        <Suspense>
          <GenreFilter />
        </Suspense>
      </div>
      <Suspense
        key={`${genre ?? ''}-${term ?? ''}`}
        fallback={
          <div className="text-center text-gray-300 text-xs py-24 font-pixel tracking-widest">
            LOADING...
          </div>
        }
      >
        <GameGrid genre={genre} q={q} />
      </Suspense>
    </div>
  )
}
