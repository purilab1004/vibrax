import { createClient } from '@/lib/supabase/server'
import HeroSection from '@/components/HeroSection'
import GameCard from '@/components/GameCard'
import Link from 'next/link'
import type { Game } from '@/lib/supabase/types'

const GENRES: { key: Game['genre']; label: string }[] = [
  { key: 'action', label: 'ACTION' },
  { key: 'adventure', label: 'ADVENTURE' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'sports', label: 'SPORTS' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: rawGames } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })
  const games = rawGames as Game[] | null

  const gamesByGenre = (genre: Game['genre']) =>
    (games ?? []).filter(g => g.genre === genre)

  const hasAnyGame = (games ?? []).length > 0

  return (
    <div>
      <HeroSection />
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-14">
        {hasAnyGame ? (
          GENRES.map(({ key, label }) => {
            const genreGames = gamesByGenre(key)
            if (genreGames.length === 0) return null
            return (
              <section key={key}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-pixel text-[#00ff41] text-xs tracking-widest">
                    {label}
                  </h2>
                  <Link
                    href={`/games?genre=${key}`}
                    className="text-xs text-gray-300 hover:text-[#00ff41] transition-colors tracking-wider"
                  >
                    VIEW ALL →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {genreGames.slice(0, 5).map(game => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </div>
              </section>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-pixel text-[10px] text-[#00ff41] tracking-widest mb-4">
              GAME OVER?
            </p>
            <p className="text-gray-400 text-sm mb-8">
              아직 등록된 게임이 없습니다.<br />첫 번째로 AI로 만든 게임을 등록해보세요!
            </p>
            <Link
              href="/submit"
              className="font-pixel text-[11px] border border-[#00ff41] text-[#00ff41] px-6 py-3 hover:bg-[#00ff41] hover:text-black transition-colors"
            >
              + SUBMIT FIRST GAME
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
