'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GameCard, {
  RoomScene, PASTELS, hashOf,
  hasCoinTicket, ticketKeyOf, playCoinSound, playStartSound,
} from '@/components/GameCard'
import LikeButton from '@/components/LikeButton'
import Reveal from '@/components/Reveal'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator } from '@/lib/supabase/types'

// 모바일 쇼츠 화면 한 장 — 하단에 아케이드 코인 투입 → PRESS START 플로우
function FeedScreen({ game }: { game: GameWithCreator }) {
  const { T } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'ready'>('idle')

  const creatorName = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
  const avatarUrl = game.profiles?.avatar_config?.previewUrl ?? null

  const insertCoin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (coinState !== 'idle') return
    if (hasCoinTicket(game.id)) { setCoinState('ready'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?redirect=/'); return }
    setCoinState('drop')
    playCoinSound()
    const { error } = await supabase.rpc('spend_vcoin', { p_game_id: game.id } as never)
    if (error) {
      if (error.message.includes('insufficient_vcoin')) {
        alert(T.games.insufficientCoin)
        setCoinState('idle')
        return
      }
      console.warn('vcoin spend skipped:', error.message)
    }
    try { sessionStorage.setItem(ticketKeyOf(game.id), String(Date.now())) } catch {}
    setTimeout(() => setCoinState('ready'), 900)
  }

  const startGame = (e: React.MouseEvent) => {
    e.stopPropagation()
    playStartSound()
    setTimeout(() => router.push(`/games/${game.id}`), 250)
  }

  return (
    <div
      className="feed-snap relative h-[100svh] overflow-hidden"
      style={{ backgroundColor: PASTELS[hashOf(game.id) % PASTELS.length] }}
      onClick={() => router.push(`/games/${game.id}`)}
    >
      {/* 방 디오라마 — 화면 상중단을 채운다 */}
      <div className="absolute inset-x-1 top-[6%] bottom-[30%]">
        <RoomScene id={game.id} views={game.view_count ?? 0} />
      </div>
      {/* 우측 액션 레일 — 틱톡 스타일 */}
      <div className="absolute right-3 bottom-[34%] z-10 flex flex-col items-center gap-4">
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
      {/* 하단 정보 + 아케이드 코인 플로우 */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-24 pt-14 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
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
        {/* 점멸 상태 라벨 */}
        <p className={`arcade-blink mt-3 font-pixel text-[11px] tracking-[0.3em] ${
          coinState === 'ready'
            ? 'text-[#4cff6a] drop-shadow-[0_0_6px_rgba(76,255,106,0.7)]'
            : 'text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]'
        }`}>
          {coinState === 'ready' ? 'PRESS START' : 'INSERT COIN'}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {/* 미니 코인 슬롯 */}
          <div className="relative w-12 h-14 shrink-0">
            <div className={`w-full h-full rounded-lg bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-1.5 transition-shadow ${
              coinState === 'ready' ? 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_0_16px_rgba(76,255,106,0.5)]' : ''
            } ${coinState === 'drop' ? 'slot-clink' : ''}`}>
              <span className="w-1.5 h-6 rounded-full bg-black shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]" />
              <span className={`w-2 h-2 rounded-full ${coinState === 'ready' ? 'bg-[#4cff6a] shadow-[0_0_8px_#4cff6a]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
            </div>
            {coinState === 'drop' && (
              <>
                <span className="gold-coin absolute left-1/2 -top-6 scale-90" aria-hidden />
                <span className="slot-spark absolute left-1/2 top-[8px] -translate-x-1/2 text-xs" aria-hidden>✨</span>
              </>
            )}
          </div>
          {coinState !== 'ready' ? (
            <button
              onClick={insertCoin}
              className="flex-1 h-12 rounded-full bg-gradient-to-b from-[#d9a71b] to-[#b3830a] text-white font-bold text-[15px] shadow-[0_4px_0_#7d5a06,0_8px_16px_rgba(0,0,0,0.45)] active:translate-y-1 active:shadow-[0_1px_0_#7d5a06] transition-all flex items-center justify-center gap-2"
            >
              🪙 × {game.coin_cost ?? 1} 코인 넣기
            </button>
          ) : (
            <button
              onClick={startGame}
              className="flex-1 h-12 rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[14px] tracking-widest shadow-[inset_0_2px_5px_rgba(255,255,255,0.35),0_5px_0_#8f1508,0_10px_18px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_2px_5px_rgba(255,255,255,0.35),0_1px_0_#8f1508] transition-all flex items-center justify-center gap-2"
            >
              ▶ START
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

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
        {sorted.map(game => (
          <FeedScreen key={game.id} game={game} />
        ))}
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
