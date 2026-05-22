'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import LikeButton from './LikeButton'
import AiBjPanel from './AiBjPanel'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'

const GENRE_LABELS: Record<Game['genre'], string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

const GENRE_COLORS: Record<Game['genre'], string> = {
  action: 'bg-red-700',
  adventure: 'bg-amber-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

interface GameCardProps {
  game: Game
}

export default function GameCard({ game }: GameCardProps) {
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const handlePlay = async () => {
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

  return (
    <>
      <button
        onClick={handlePlay}
        className="group block w-full text-left"
      >
        <div className="bg-[#111] border border-gray-800 group-hover:border-[#00ff41] transition-all duration-200 overflow-hidden">
          <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
            <Image
              src={game.thumbnail_url}
              alt={game.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="font-pixel text-[10px] text-white bg-[#00ff41]/90 text-black px-3 py-2">
                ▶ PLAY
              </span>
            </div>
          </div>
          <div className="p-3">
            <span
              className={`inline-block font-pixel text-[9px] px-2 py-1 text-white ${GENRE_COLORS[game.genre]}`}
            >
              {GENRE_LABELS[game.genre]}
            </span>
            <h3 className="mt-2 text-sm font-medium text-gray-100 truncate leading-tight">
              {game.title}
            </h3>
            <div className="flex items-center justify-between mt-2">
              <span className="flex items-center gap-1 text-[10px] text-gray-600 font-pixel">
                <span className="text-[11px]">👁</span>{game.view_count ?? 0}
              </span>
              <LikeButton gameId={game.id} size="sm" />
            </div>
            {/* AI AJ indicator */}
            <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-800`}>
              <div className={`w-5 h-5 shrink-0 rounded-full border ${AJ_PERSONAS[game.genre].borderColor} overflow-hidden`}>
                <Image
                  src="/aibot.png"
                  alt={AJ_PERSONAS[game.genre].name}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="font-pixel text-[9px] text-gray-400">{AJ_PERSONAS[game.genre].name}</span>
              <span className="flex items-center gap-0.5 text-[8px] text-red-500 font-pixel ml-auto">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse inline-block" />
                LIVE
              </span>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
            <div className="flex items-center gap-3">
              <span
                className={`font-pixel text-[9px] px-2 py-1 text-white ${GENRE_COLORS[game.genre]}`}
              >
                {GENRE_LABELS[game.genre]}
              </span>
              <span className="text-sm font-medium text-white">{game.title}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] transition-colors px-3 py-1 border border-gray-700 hover:border-[#00ff41]"
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Body: iframe + AI AJ panel */}
          <div className="relative flex flex-row flex-1 min-h-0">
            <div className="flex-1 min-h-0 pb-[53px] md:pb-0">
              <iframe
                src={game.play_url}
                className="w-full h-full border-0"
                allow="fullscreen; autoplay"
                title={game.title}
              />
            </div>
            <AiBjPanel genre={game.genre} gameTitle={game.title} />
          </div>
        </div>
      )}
    </>
  )
}
