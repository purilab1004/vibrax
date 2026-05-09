'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Genre } from '@/lib/supabase/types'

type GenreOption = Genre | 'all'

const GENRES: { key: GenreOption; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'action', label: 'ACTION' },
  { key: 'adventure', label: 'ADVENTURE' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'sports', label: 'SPORTS' },
]

export default function GenreFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = (searchParams.get('genre') ?? 'all') as GenreOption

  const handleSelect = (genre: GenreOption) => {
    const params = new URLSearchParams(searchParams.toString())
    if (genre === 'all') {
      params.delete('genre')
    } else {
      params.set('genre', genre)
    }
    const query = params.toString()
    router.push(`/games${query ? `?${query}` : ''}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {GENRES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handleSelect(key)}
          className={`font-pixel text-[10px] px-4 py-2 border transition-colors ${
            current === key
              ? 'bg-[#00ff41] text-black border-[#00ff41]'
              : 'text-gray-400 border-gray-700 hover:border-[#00ff41] hover:text-[#00ff41]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
