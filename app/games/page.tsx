import { createClient } from '@/lib/supabase/server'
import GamesBrowse from '@/components/GamesBrowse'
import MobileGamesTools from '@/components/MobileGamesTools'
import GenreSidebar from '@/components/GenreSidebar'
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
    if (term) {
      // 제목만이 아니라 주제 문구(티저)·설명까지, 키워드 단위로 매칭 (예: "떨어지는 블록", "멈추면 패배")
      const cols = ['title', 'teaser', 'teaser_en', 'description']
      const tokens = term.split(/[\s,]+/).map(t => t.replace(/[%*(),.]/g, '').trim()).filter(t => t.length >= 1).slice(0, 6)
      const orStr = (tokens.length ? tokens : [term.replace(/[%*(),.]/g, '')]).flatMap(tok => cols.map(c => `${c}.ilike.*${tok}*`)).join(',')
      if (orStr) x = x.or(orStr)
    }
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
    <div className="w-full md:px-6">
      {/* 모바일 — 검색·카테고리는 우상단 버튼을 눌러야 나온다 (피드를 가리지 않게) */}
      <Suspense>
        <MobileGamesTools />
      </Suspense>

      <div className="md:flex md:gap-6">
        {/* 데스크톱 — 좌측 카테고리 + 메뉴 사이드바 */}
        <aside className="hidden md:block w-52 shrink-0 sticky top-20 self-start">
          <Suspense>
            <GenreSidebar />
          </Suspense>
        </aside>

        <div className="flex-1 min-w-0">
          {term && (
            <p className="hidden md:block text-xs text-[#4a4337] mb-2">🔍 &quot;{term}&quot;</p>
          )}
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
      </div>
    </div>
  )
}
