import { createClient } from '@/lib/supabase/server'
import GameCard from '@/components/GameCard'
import GenreFilter from '@/components/GenreFilter'
import { Suspense } from 'react'
import type { Game, Genre } from '@/lib/supabase/types'

const VALID_GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

interface Props {
  searchParams: Promise<{ genre?: string }>
}

async function GameGrid({ genre }: { genre?: string }) {
  const supabase = await createClient()
  const validGenre = VALID_GENRES.includes(genre as Genre) ? (genre as Genre) : undefined

  let query = supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })

  if (validGenre) {
    query = query.eq('genre', validGenre)
  }

  const { data: rawGames } = await query
  const games = rawGames as Game[] | null

  if (!games || games.length === 0) {
    return (
      <p className="text-center text-gray-600 text-sm py-24">
        {validGenre ? `${validGenre.toUpperCase()} 장르의 게임이 없습니다.` : '아직 등록된 게임이 없습니다.'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {games.map(game => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  )
}

export default async function GamesPage({ searchParams }: Props) {
  const { genre } = await searchParams

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">GAMES</h1>
        <span className="text-xs text-gray-600">AI 바이브코딩 게임 모음</span>
      </div>
      <div className="mb-8">
        <Suspense>
          <GenreFilter />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="text-center text-gray-600 text-xs py-24 font-pixel tracking-widest">
            LOADING...
          </div>
        }
      >
        <GameGrid genre={genre} />
      </Suspense>
    </div>
  )
}
