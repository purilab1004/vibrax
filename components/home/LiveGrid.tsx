'use client'

import { useState } from 'react'
import GameCard from '@/components/GameCard'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// kick식 홈 그리드 — 🔴 LIVE NOW 헤더 + 장르 칩 필터 + 통합 카드 그리드.
// 전체 보기일 때 최다 조회수 게임 1개를 2칸 폭 피처드로 키운다.
export default function LiveGrid({ games }: { games: GameWithCreator[] }) {
  const [genre, setGenre] = useState<'' | Genre>('')
  const { T } = useLang()

  const filtered = genre ? games.filter(g => g.genre === genre) : games
  const featuredId =
    !genre && filtered.length > 3
      ? [...filtered].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))[0].id
      : null
  const ordered = featuredId
    ? [filtered.find(g => g.id === featuredId)!, ...filtered.filter(g => g.id !== featuredId)]
    : filtered

  const chip = (value: '' | Genre, label: string) => (
    <button
      key={value || 'all'}
      onClick={() => setGenre(value)}
      className={`font-pixel text-[11px] tracking-widest px-4 py-2.5 border transition-colors ${
        genre === value
          ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10'
          : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <h2 className="font-pixel text-xs text-white tracking-widest flex items-center gap-2 mr-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {T.games.liveNow}
        </h2>
        {chip('', T.games.all)}
        {GENRES.map(g => chip(g, T.genres[g]))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10">
        {ordered.map(game => (
          <div key={game.id} className={game.id === featuredId ? 'sm:col-span-2' : ''}>
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
