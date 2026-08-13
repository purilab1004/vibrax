import { createClient } from '@/lib/supabase/server'
import GameCard from '@/components/GameCard'
import GenreFilter from '@/components/GenreFilter'
import Reveal from '@/components/Reveal'
import { Suspense } from 'react'
import type { Genre, GameWithCreator } from '@/lib/supabase/types'
import { selectGamesWithCreator } from '@/lib/supabase/games'

const VALID_GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 홈과 같은 매소너리 리듬 — 정사각 이상 비율만 (id 기반 고정)
const ASPECTS = ['aspect-square', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[5/6]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/4]'] as const

function aspectOf(id: string, i: number): string {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return ASPECTS[Math.abs(h + i) % ASPECTS.length]
}

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

  return (
    <div className="columns-2 lg:columns-3 2xl:columns-4 gap-5">
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
  )
}

export default async function GamesPage({ searchParams }: Props) {
  const { genre, q, creator } = await searchParams
  const term = q?.trim()

  return (
    <div className="w-full px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-pixel text-[#2563eb] text-sm tracking-widest">GAMES</h1>
        <span className="text-xs text-[#4a4337]">
          {term ? `🔍 "${term}"` : 'AI 바이브코딩 게임 모음'}
        </span>
      </div>
      {/* 장르 필터 — 스크롤해도 상단에 따라붙는 유리 바 */}
      <div className="sticky top-16 z-40 mb-8 flex justify-center md:justify-start">
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
