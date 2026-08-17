'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  RoomScene, auroraOf, hashOf,
  hasCoinTicket, ticketKeyOf, playCoinSound, playStartSound,
} from '@/components/GameCard'
import LikeButton from '@/components/LikeButton'
import Reveal from '@/components/Reveal'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import LOCAL_TEASERS from '@/lib/teasers-local.json'
import { titleFont } from '@/lib/fonts'
import type { GameWithCreator } from '@/lib/supabase/types'
import { avatarPreviewUrl, avatarFrames } from '@/lib/jeumto/config'
import { useLiveBroadcasts } from '@/lib/live/useLiveBroadcasts'

// 모바일 쇼츠 화면 한 장 — 하단에 아케이드 코인 투입 → PRESS START 플로우
export default function FeedScreen({ game, golden = false, rank }: { game: GameWithCreator; golden?: boolean; rank?: number }) {
  const { T, lang } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'ready'>('idle')

  const creatorName = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
  const avatarUrl = avatarPreviewUrl(game.profiles?.avatar_config)
  const liveMap = useLiveBroadcasts()
  const avatarFramesV = avatarFrames(game.profiles?.avatar_config)

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
      className="feed-snap grain relative h-[100svh] overflow-hidden"
      style={auroraOf(game.id, golden)}
    >
      <Reveal className="absolute inset-0">
      {/* 조회수 랭킹 배지 — 상단 우측 */}
      {rank && rank <= 10 && (
        <span className={`absolute top-4 right-4 z-10 font-pixel text-[13px] px-3 py-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)] ${
          rank === 1 ? 'bg-[#c9940c] text-white' : rank === 2 ? 'bg-gray-300 text-[#241f17]' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-white/85 text-[#241f17]'
        }`}>
          #{rank}
        </span>
      )}
      {/* 상단 중앙 — Jua 포스터 타이틀 */}
      <div className="absolute inset-x-0 top-[16%] px-5 text-center z-[5]">
        <h3 className={`${titleFont.className} text-[48px] leading-[1.25] text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]`}>
          {lang === 'en'
            ? (game.teaser_en || T.games.teasers[hashOf(game.id) % T.games.teasers.length])
            : (game.teaser || (LOCAL_TEASERS as Record<string, string>)[game.id] || T.games.teasers[hashOf(game.id) % T.games.teasers.length])}
        </h3>
      </div>
      {/* 방 디오라마 — 캐릭터는 중앙 */}
      <div className="absolute inset-x-1 top-[24%] bottom-[26%]">
        <RoomScene id={game.id} views={game.view_count ?? 0} avatar={avatarFramesV} live={liveMap[game.id] ?? null} />
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
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <span className="avatar-ring"><span className="avatar-wave w-6 h-6 shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={creatorName} className="avatar-bob w-full h-full object-cover object-top" />
            ) : (
              <span className="font-pixel text-[10px] text-white">{creatorName.charAt(0).toUpperCase()}</span>
            )}
          </span></span>
          {creatorName}
        </p>
        {/* 점멸 상태 라벨 */}
        <p className={`arcade-blink mt-3 font-pixel text-[14px] tracking-[0.3em] ${
          coinState === 'ready'
            ? 'text-[#4cff6a] drop-shadow-[0_0_6px_rgba(76,255,106,0.7)]'
            : 'text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]'
        }`}>
          {coinState === 'ready' ? 'PRESS START' : 'INSERT COIN'}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {coinState !== 'ready' ? (
            <button
              onClick={insertCoin}
              disabled={coinState === 'drop'}
              className={`flex-1 h-[52px] ${titleFont.className} text-[21px] rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#d18f00] transition-all flex items-center justify-center gap-2 disabled:opacity-90`}
            >
              {coinState === 'drop' ? (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none" aria-hidden><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                  코인 투입 중...
                </>
              ) : (
                <>🪙 × {game.coin_cost ?? 1} 코인 넣기</>
              )}
            </button>
          ) : (
            <button
              onClick={startGame}
              className="flex-1 h-[52px] rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[17px] tracking-widest shadow-[inset_0_2px_5px_rgba(255,255,255,0.35),0_5px_0_#8f1508,0_10px_18px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_2px_5px_rgba(255,255,255,0.35),0_1px_0_#8f1508] transition-all flex items-center justify-center gap-2"
            >
              ▶ START
            </button>
          )}
          {/* 미니 코인 슬롯 */}
          <div className="relative w-12 h-[58px] shrink-0">
            <div className={`w-full h-full rounded-lg bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-1.5 transition-shadow ${
              coinState === 'ready' ? 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_0_16px_rgba(76,255,106,0.5)]' : ''
            } ${coinState === 'drop' ? 'slot-clink' : ''}`}>
              <span className="w-1.5 h-7 rounded-full bg-black shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]" />
              <span className={`w-2.5 h-2.5 rounded-full ${coinState === 'ready' ? 'bg-[#4cff6a] shadow-[0_0_8px_#4cff6a]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
            </div>
            {coinState === 'drop' && (
              <>
                <span className="gold-coin absolute left-1/2 -top-6" style={{ '--coin-drop': '31px' } as React.CSSProperties} aria-hidden />
                <span className="slot-spark absolute left-1/2 top-[8px] -translate-x-1/2 text-xs" aria-hidden>✨</span>
              </>
            )}
          </div>
        </div>
      </div>
      </Reveal>
    </div>
  )
}
