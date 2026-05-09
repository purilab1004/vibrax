import Image from 'next/image'
import type { Game } from '@/lib/supabase/types'

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
  return (
    <a
      href={game.play_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
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
        </div>
      </div>
    </a>
  )
}
