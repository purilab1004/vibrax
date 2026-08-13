import { createClient } from '@/lib/supabase/server'
import GamesBrowse from '@/components/GamesBrowse'
import GenreFilter from '@/components/GenreFilter'
import { Suspense } from 'react'
import type { Genre, GameWithCreator } from '@/lib/supabase/types'
import { selectGamesWithCreator } from '@/lib/supabase/games'

const VALID_GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

interface Props {
  searchParams: Promise<{ genre?: string; q?: string; creator?: string }>
}

async function GameGrid({ genre, q, creator }: { genre?: string; q?: string; creator?: string }) {
  const supabase = await createClient()
  const validGenre = VALID_GENRES.includes(genre as Genre) ? (genre as Genre) : undefined
  const term = q?.trim()

  const games = await selectGamesWithCreator<GameWithCreator[]>(supabase, query => {
    let x = query.order('created_at', { ascending: false })
    if (validGenre) x = x.eq('genre', validGenre)
    if (term) x = x.ilike('title', `%${term}%`)
    if (creator) x = x.eq('user_id', creator)
    return x
  })

  if (!games || games.length === 0) {
    return (
      <p className="text-center text-[#4a4337] text-sm py-24">
        {term
          ? `"${term}" 검색 결과가 없습니다.`
          : validGenre ? `${validGenre.toUpperCase()} 장르의 게임이 없습니다.` : '아직 등록된 게임이 없습니다.'}
      </p>
    )
  }

  return <GamesBrowse games={games} />
}

export default async function GamesPage({ searchParams }: Props) {
  const { genre, q, creator } = await searchParams
  const term = q?.trim()

  return (
    <div className="w-full md:px-8 md:py-10">
      <div className="flex items-center justify-between mb-6 px-4 pt-6 md:px-0 md:pt-0">
        <h1 className="font-pixel text-[#2563eb] text-sm tracking-widest">GAMES</h1>
        <span className="text-xs text-[#4a4337]">
          {term ? `🔍 "${term}"` : 'AI 바이브코딩 게임 모음'}
        </span>
      </div>
      {/* 장르 필터 — 스크롤해도 상단에 따라붙는 유리 바 */}
      <div className="sticky top-16 z-40 mb-4 md:mb-8 px-4 md:px-0 flex justify-center md:justify-start">
        <Suspense>
          <GenreFilter />
        </Suspense>
      </div>
      <Suspense
        key={`${genre ?? ''}-${term ?? ''}-${creator ?? ''}`}
        fallback={
          <div className="text-center text-[#4a4337] text-xs py-24 font-pixel tracking-widest">
            LOADING...
          </div>
        }
      >
        <GameGrid genre={genre} q={q} creator={creator} />
      </Suspense>
    </div>
  )
}
