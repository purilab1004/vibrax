import { createClient } from '@/lib/supabase/server'
import HeroSection from '@/components/HeroSection'
import HomeBanner from '@/components/HomeBanner'
import HomeMosaic from '@/components/home/HomeMosaic'
import Link from 'next/link'
import type { GameWithCreator } from '@/lib/supabase/types'
import { selectGamesWithCreator } from '@/lib/supabase/games'

export default async function HomePage() {
  const supabase = await createClient()
  const games = await selectGamesWithCreator<GameWithCreator[]>(
    supabase,
    q => q.order('created_at', { ascending: false }),
  )

  const hasAnyGame = (games ?? []).length > 0

  return (
    <div>
      <HomeBanner />
      <HeroSection />
      <div className="max-w-7xl mx-auto px-6 py-10">
        {hasAnyGame ? (
          <HomeMosaic games={games ?? []} />
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-pixel text-[11px] text-[#0e7573] tracking-widest mb-4">
              GAME OVER?
            </p>
            <p className="text-[#6b6152] text-sm mb-8">
              아직 등록된 게임이 없습니다.<br />첫 번째로 AI로 만든 게임을 등록해보세요!
            </p>
            <Link
              href="/submit"
              className="font-pixel text-[11px] border border-[#0e7573] text-[#0e7573] px-6 py-3 hover:bg-[#0e7573] hover:text-white transition-colors"
            >
              + SUBMIT FIRST GAME
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
