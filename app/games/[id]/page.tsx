import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Game } from '@/lib/supabase/types'

type GameWithProfile = Game & { profiles: { username: string } | null }

const GENRE_LABELS: Record<string, string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

const GENRE_COLORS: Record<string, string> = {
  action: 'bg-red-700',
  adventure: 'bg-amber-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: rawGame } = await supabase
    .from('games')
    .select('title, genre, thumbnail_url')
    .eq('id', id)
    .single()
  const game = rawGame as Pick<Game, 'title' | 'genre' | 'thumbnail_url'> | null

  if (!game) return { title: 'Game — Vibrax' }

  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre
  return {
    title: `${game.title} — Vibrax`,
    description: `${game.title}은(는) AI 바이브코딩으로 만들어진 ${genreLabel} 게임입니다. Vibrax에서 지금 바로 플레이하세요.`,
    openGraph: {
      title: `${game.title} — Vibrax`,
      description: `AI 바이브코딩 ${genreLabel} 게임 — ${game.title}`,
      images: [{ url: game.thumbnail_url, alt: game.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.title} — Vibrax`,
      images: [game.thumbnail_url],
    },
  }
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawGameDetail } = await supabase
    .from('games')
    .select('*, profiles(username)')
    .eq('id', id)
    .single()
  const game = rawGameDetail as GameWithProfile | null

  if (!game) notFound()

  const author = game.profiles?.username ?? 'unknown'
  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre.toUpperCase()
  const genreColor = GENRE_COLORS[game.genre] ?? 'bg-gray-700'

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href="/games"
        className="text-xs text-gray-600 hover:text-[#00ff41] transition-colors mb-6 inline-block tracking-wider"
      >
        ← BACK TO GAMES
      </Link>

      <div className="relative aspect-video w-full mb-8 overflow-hidden bg-gray-900 border border-gray-800">
        <Image
          src={game.thumbnail_url}
          alt={game.title}
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block font-pixel text-[9px] px-2 py-1 text-white ${genreColor} mb-3`}
          >
            {genreLabel}
          </span>
          <h1 className="text-2xl font-semibold text-white mb-2 leading-tight">
            {game.title}
          </h1>
          <p className="text-gray-600 text-xs tracking-wider">
            by {author}
          </p>
        </div>
        <a
          href={game.play_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-pixel text-[11px] bg-[#00ff41] text-black px-8 py-4 hover:bg-[#00cc33] transition-colors whitespace-nowrap tracking-widest"
        >
          ▶ PLAY NOW
        </a>
      </div>
    </div>
  )
}
