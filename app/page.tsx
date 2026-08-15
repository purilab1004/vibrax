import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import HeroSection from '@/components/HeroSection'
import HomeBanner from '@/components/HomeBanner'
import HomeMosaic from '@/components/home/HomeMosaic'
import Link from 'next/link'
import type { GameWithCreator } from '@/lib/supabase/types'
import { selectGamesWithCreator } from '@/lib/supabase/games'

// 홈 게임 목록 — 서버 캐시 60초. 공개 데이터라 쿠키 없는 anon 클라이언트로 조회해
// 요청마다 DB를 때리지 않고 즉시 응답한다 (새 게임은 최대 1분 내 반영).
const getHomeGames = unstable_cache(
  async () => {
    const supabase = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    return selectGamesWithCreator<GameWithCreator[]>(
      supabase,
      q => q.order('created_at', { ascending: false }),
    )
  },
  ['home-games'],
  { revalidate: 60 },
)

export default async function HomePage() {
  const games = await getHomeGames()

  const hasAnyGame = (games ?? []).length > 0

  return (
    <div>
      <HomeBanner />
      <HeroSection games={games ?? []} />
      {/* 모바일은 쇼츠 피드가 전체 화면을 쓰므로 여백 없음, 데스크톱은 매소너리 여백 */}
      <div className="w-full md:px-8 md:py-14">
        {hasAnyGame ? (
          <HomeMosaic games={games ?? []} />
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-pixel text-[11px] text-[#2563eb] tracking-widest mb-4">
              GAME OVER?
            </p>
            <p className="text-[#6b6152] text-sm mb-8">
              아직 등록된 게임이 없습니다.<br />첫 번째로 AI로 만든 게임을 등록해보세요!
            </p>
            <Link
              href="/submit"
              className="font-pixel text-[11px] border border-[#2563eb] text-[#2563eb] px-6 py-3 hover:bg-[#2563eb] hover:text-white transition-colors"
            >
              + SUBMIT FIRST GAME
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
