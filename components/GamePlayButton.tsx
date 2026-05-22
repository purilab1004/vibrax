'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'
import AiBjPanel from './AiBjPanel'

interface Props {
  game: Game
  genreColor: string
  genreLabel: string
}

export default function GamePlayButton({ game, genreColor, genreLabel }: Props) {
  const [open, setOpen] = useState(false)
  const { T } = useLang()
  const supabase = createClient()

  const handlePlay = () => {
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

  return (
    <>
      <button
        onClick={handlePlay}
        className="shrink-0 font-pixel text-[11px] bg-[#00ff41] text-black px-8 py-4 hover:bg-[#00cc33] transition-colors whitespace-nowrap tracking-widest"
      >
        {T.games.playNow}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
            <div className="flex items-center gap-3">
              <span className={`font-pixel text-[9px] px-2 py-1 text-white ${genreColor}`}>
                {genreLabel}
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
          <div className="flex flex-1 min-h-0">
            <iframe
              src={game.play_url}
              className="flex-1 border-0"
              allow="fullscreen; autoplay"
              title={game.title}
            />
            <AiBjPanel genre={game.genre} />
          </div>
        </div>
      )}
    </>
  )
}
