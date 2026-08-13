'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GameCard, { RoomScene, PASTELS, hashOf } from '@/components/GameCard'
import LikeButton from '@/components/LikeButton'
import Reveal from '@/components/Reveal'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 핀터레스트 매소너리 — 정사각 이상(세로형)만 사용해 캐릭터가 답답하지 않게 (id 기반으로 고정)
const ASPECTS = ['aspect-square', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[5/6]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/4]'] as const

function aspectOf(id: string, i: number): string {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return ASPECTS[Math.abs(h + i) % ASPECTS.length]
}

export default function HomeMosaic({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const router = useRouter()

  const sorted = [...games].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))

  return (
    <div>
      {/* ── 모바일: 쇼츠 피드 — 화면 전체를 채우고 스와이프하면 다음 게임 (유튜브 쇼츠/틱톡) ── */}
      <div className="md:hidden">
        {sorted.map(game => {
          const creatorName = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
          const avatarUrl = game.profiles?.avatar_config?.previewUrl ?? null
          return (
            <div
              key={game.id}
              className="feed-snap relative h-[100svh] overflow-hidden"
              style={{ backgroundColor: PASTELS[hashOf(game.id) % PASTELS.length] }}
              onClick={() => router.push(`/games/${game.id}`)}
            >
              {/* 방 디오라마 — 화면 상중단을 채운다 */}
              <div className="absolute inset-x-1 top-[6%] bottom-[26%]">
                <RoomScene id={game.id} views={game.view_count ?? 0} />
              </div>
              {/* 우측 액션 레일 — 틱톡 스타일 */}
              <div className="absolute right-3 bottom-[30%] z-10 flex flex-col items-center gap-4">
                <div
                  className="bg-white/85 backdrop-blur-sm rounded-full px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
                  onClick={e => e.stopPropagation()}
                >
                  <LikeButton gameId={game.id} size="lg" />
                </div>
                <div className="flex flex-col items-center gap-0.5 text-white/85 drop-shadow">
                  <ViewerIcon className="w-6 h-6" />
                  <span className="text-[12px] font-bold">{formatViewers(game.view_count ?? 0)}</span>
                </div>
              </div>
              {/* 하단 정보 + PLAY */}
              <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 pt-14 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
                <h3 className="text-2xl font-extrabold text-white leading-snug line-clamp-2 pr-14">
                  {game.title}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-white/75">
                  <span className="w-6 h-6 shrink-0 rounded-full border border-white/60 overflow-hidden bg-white/70 inline-flex items-center justify-center">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={creatorName} className="w-full h-full object-cover object-top" />
                    ) : (
                      <span className="font-pixel text-[10px] text-[#857a68]">{creatorName.charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  {creatorName}
                </p>
                <button className="mt-4 w-full h-12 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white font-bold text-base shadow-[0_8px_24px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7-11-7Z" /></svg>
                  PLAY
                  <span className="ml-1 bg-white/25 rounded-full px-2.5 py-0.5 text-[13px]">🪙 {game.coin_cost ?? 1}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 데스크톱: 핀터레스트 매소너리 ── */}
      <div className="hidden md:block">
      {/* 헤딩 — LIVE NOW */}
      <Reveal className="mb-6">
        <h2 className="font-pixel text-xl text-[#241f17] tracking-wide flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {T.games.liveNow}
        </h2>
      </Reveal>

      {/* 매소너리 그리드 — 풀블리드, 열 단위로 벽돌처럼 쌓이고 스크롤 진입 시 하나씩 등장 */}
      <div className="columns-2 lg:columns-3 2xl:columns-4 gap-5">
        {/* 리딩 CTA — 다음 게임의 주인공 */}
        <Reveal delay={80} className="mb-5 break-inside-avoid">
          <Link
            href="/studio"
            className="group flex flex-col items-center justify-center gap-3 aspect-[4/5] w-full rounded-xl border-2 border-dashed border-[#cfc4ab] bg-white/60 hover:border-[#2563eb] hover:bg-white transition-colors"
          >
            <span className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] flex items-center justify-center shadow-[0_6px_20px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-sm md:text-base font-bold text-[#4a4337] group-hover:text-[#2563eb] transition-colors text-center px-4">
              {T.games.beNextHero}
            </span>
          </Link>
        </Reveal>

        {sorted.map((game, i) => (
          <Reveal key={game.id} delay={(i % 4) * 80} className="mb-5 break-inside-avoid">
            <GameCard
              variant="tile"
              aspectClass={aspectOf(game.id, i)}
              game={game}
              creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
              creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
              creatorCountry={game.profiles?.country ?? null}
              bjAvatarConfig={game.profiles?.avatar_config ?? null}
            />
          </Reveal>
        ))}
      </div>
      </div>
    </div>
  )
}
