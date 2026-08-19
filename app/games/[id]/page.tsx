import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Game } from '@/lib/supabase/types'
import GamePlayButton from '@/components/GamePlayButton'
import ViewerIcon from '@/components/ViewerIcon'
import LikeButton from '@/components/LikeButton'
import ShareButton from '@/components/ShareButton'
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
    .select('title, genre, thumbnail_url, description, teaser')
    .eq('id', id)
    .single()
  const game = rawGame as Pick<Game, 'title' | 'genre' | 'thumbnail_url' | 'description' | 'teaser'> | null

  if (!game) return { title: 'Game — Vibrexcup' }

  const genreLabel = GENRE_LABELS[game.genre] ?? game.genre
  const desc = (game.description?.trim() || game.teaser?.trim() || '') 
  return {
    title: `${game.title} — Vibrexcup`,
    description: desc ? `${game.title} — ${desc.slice(0, 140)} (${genreLabel} · 무료 웹 게임, 설치 없이 브라우저에서 바로 플레이)` : `${game.title}은(는) AI 바이브코딩으로 만들어진 ${genreLabel} 게임입니다. Vibrexcup에서 설치 없이 바로 플레이하세요.`,
    alternates: { canonical: `https://vibrexcup.com/games/${id}` },
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

  const gameJsonLd = {
    '@context': 'https://schema.org', '@type': 'VideoGame', name: game.title, url: `https://vibrexcup.com/games/${game.id}`, image: game.thumbnail_url,
    description: game.description || game.teaser || `${game.title} — AI 바이브코딩으로 만든 ${genreLabel} 웹 게임`,
    genre: genreLabel, gamePlatform: ['Web browser', 'Mobile web'], applicationCategory: 'Game', operatingSystem: 'Any', playMode: 'SinglePlayer', inLanguage: game.language === 'en' ? 'en' : 'ko',
    author: { '@type': 'Person', name: author }, publisher: { '@type': 'Organization', name: 'Vibrexcup', url: 'https://vibrexcup.com' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/PlayAction', userInteractionCount: game.view_count ?? 0 },
    datePublished: game.created_at, isAccessibleForFree: true,
  }
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Vibrexcup', item: 'https://vibrexcup.com' }, { '@type': 'ListItem', position: 2, name: 'Games', item: 'https://vibrexcup.com/games' }, { '@type': 'ListItem', position: 3, name: game.title, item: `https://vibrexcup.com/games/${game.id}` } ] }
  return (
    <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 md:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <div className="relative aspect-video w-full mb-8 overflow-hidden bg-gray-900 border border-[#ebe4d6]">
        <Image
          src={game.thumbnail_url}
          alt={game.title}
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block font-pixel text-[11px] px-2 py-1 text-white rounded ${genreColor}`}
            >
              {genreLabel}
            </span>
            {game.language && (
              <span className="inline-block font-pixel text-[11px] px-2 py-1 border border-[#ddd3bf] text-[#6b6152]">
                {game.language === 'ko' ? '한국어' : 'English'}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-[#241f17] mb-2 leading-tight">
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
        <div className="flex gap-3 shrink-0 w-full md:w-auto [&>button]:flex-1 md:[&>button]:flex-none">
          <GamePlayButton game={game} genreColor={genreColor} genreLabel={genreLabel} bjName={author} />
          <ShareButton title={game.title} gameId={game.id} />
        </div>
      </div>
    </div>
  )
}
