import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Game } from '@/lib/supabase/types'
import GamePlayButton from '@/components/GamePlayButton'
import ViewerIcon from '@/components/ViewerIcon'
import LikeButton from '@/components/LikeButton'
import { selectGamesWithCreator } from '@/lib/supabase/games'

type GameWithProfile = Game & { profiles: { username: string; agent_name: string | null } | null }

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

  if (!game) return { title: 'Game — Vibrexcup' }

  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre
  return {
    title: `${game.title} — Vibrexcup`,
    description: `${game.title}은(는) AI 바이브코딩으로 만들어진 ${genreLabel} 게임입니다. Vibrexcup에서 지금 바로 플레이하세요.`,
    openGraph: {
      title: `${game.title} — Vibrexcup`,
      description: `AI 바이브코딩 ${genreLabel} 게임 — ${game.title}`,
      images: [{ url: game.thumbnail_url, alt: game.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.title} — Vibrexcup`,
      images: [game.thumbnail_url],
    },
  }
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const game = await selectGamesWithCreator<GameWithProfile>(
    supabase,
    q => q.eq('id', id).single(),
  )

  if (!game) notFound()

  const author = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre.toUpperCase()
  const genreColor = GENRE_COLORS[game.genre] ?? 'bg-gray-700'

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href="/games"
        className="text-xs text-[#4a4337] hover:text-[#0284c7] transition-colors mb-6 inline-block tracking-wider"
      >
        ← BACK TO GAMES
      </Link>

      <div className="relative aspect-video w-full mb-8 overflow-hidden bg-gray-900 border border-[#ebe4d6]">
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
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block font-pixel text-[11px] px-2 py-1 text-[#241f17] ${genreColor}`}
            >
              {genreLabel}
            </span>
            {game.language && (
              <span className="inline-block font-pixel text-[11px] px-2 py-1 border border-[#ddd3bf] text-[#6b6152]">
                {game.language === 'ko' ? '한국어' : 'English'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-[#241f17] mb-2 leading-tight">
            {game.title}
          </h1>
          <p className="text-[#4a4337] text-xs tracking-wider mb-3">by {author}</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-[#857a68] font-pixel">
              <ViewerIcon className="w-3.5 h-3.5" />{game.view_count ?? 0}
            </span>
            <LikeButton gameId={game.id} size="md" />
          </div>
        </div>
        <GamePlayButton game={game} genreColor={genreColor} genreLabel={genreLabel} bjName={author} />
      </div>
    </div>
  )
}
