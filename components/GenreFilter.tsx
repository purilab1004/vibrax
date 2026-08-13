'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Genre } from '@/lib/supabase/types'

type GenreOption = Genre | 'all'

const GENRES: { key: GenreOption; label: string; emoji: string }[] = [
  { key: 'all', label: 'ALL', emoji: '✦' },
  { key: 'action', label: 'ACTION', emoji: '⚡' },
  { key: 'adventure', label: 'ADVENTURE', emoji: '🧭' },
  { key: 'strategy', label: 'STRATEGY', emoji: '♟️' },
  { key: 'sports', label: 'SPORTS', emoji: '🏆' },
]

// 장르 필터 — 유리 알약 바 안에서 활성 장르가 그라디언트 필로 빛난다
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
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 backdrop-blur-xl border border-[#ebe4d6] p-1.5 shadow-[0_4px_20px_rgba(36,31,23,0.08)] overflow-x-auto scrollbar-hide max-w-full">
      {GENRES.map(({ key, label, emoji }) => (
        <button
          key={key}
          onClick={() => handleSelect(key)}
          className={`shrink-0 flex items-center gap-1.5 font-pixel text-[11px] tracking-wider px-4 py-2 rounded-full transition-all ${
            current === key
              ? 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]'
              : 'text-[#6b6152] hover:text-[#2563eb] hover:bg-[#2563eb]/5'
          }`}
        >
          <span aria-hidden>{emoji}</span>
          {label}
        </button>
      ))}
    </div>
  )
}
