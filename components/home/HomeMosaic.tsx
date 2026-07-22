'use client'

import { useState } from 'react'
import GameCard from '@/components/GameCard'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// higgsfield식 홈 — 텍스트 없는 콘텐츠 타일이 벽처럼 깔리고, 정보는 썸네일 위 오버레이.
// 상단에 장르 탭, 조회수 상위 2개는 2칸 폭으로 크게(dense flow로 빈칸 없이 채움).
export default function HomeMosaic({ games }: { games: GameWithCreator[] }) {
  const [genre, setGenre] = useState<'' | Genre>('')
  const { T } = useLang()

  const filtered = genre ? games.filter(g => g.genre === genre) : games
  const featured = new Set(
    [...filtered]
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 2)
      .map(g => g.id),
  )

  const tab = (value: '' | Genre, label: string) => (
    <button
      key={value || 'all'}
      onClick={() => setGenre(value)}
      className={`font-pixel text-[11px] tracking-widest px-4 py-2.5 rounded-full border transition-colors ${
        genre === value
          ? 'border-[#00ff41] text-black bg-[#00ff41]'
          : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {tab('', T.games.all)}
        {GENRES.map(g => tab(g, T.genres[g]))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 grid-flow-dense">
        {filtered.map(game => (
          <div key={game.id} className={featured.has(game.id) ? 'sm:col-span-2' : ''}>
            <GameCard
              variant="tile"
              game={game}
              creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
              creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
              creatorCountry={game.profiles?.country ?? null}
              bjAvatarConfig={game.profiles?.avatar_config ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
