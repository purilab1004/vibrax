'use client'

import { useState, useEffect, useRef } from 'react'
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
import { useIsNativeApp } from '@/lib/isNativeApp'
import LOCAL_TEASERS from '@/lib/teasers-local.json'
import { titleFont, galaxyFont } from '@/lib/fonts'
import type { GameWithCreator } from '@/lib/supabase/types'
import { avatarPreviewUrl, avatarFrames } from '@/lib/jeumto/config'
import { countryFlag, flagRingStyle } from '@/lib/country'
import ThumbBackdrop from '@/components/home/ThumbBackdrop'
import { useDominantHue } from '@/lib/dominantHue'
import PlayModeBadge from '@/components/PlayModeBadge'
import { useFeedTrack } from '@/lib/feedBgm'

// 모바일 쇼츠 화면 한 장 — 하단에 아케이드 코인 투입 → PRESS START 플로우
export default function FeedScreen({ game, golden = false, rank }: { game: GameWithCreator; golden?: boolean; rank?: number }) {
  const { T, lang } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const isApp = useIsNativeApp()
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'ready'>('idle')
  const rootRef = useRef<HTMLDivElement>(null)
  useFeedTrack(rootRef, game.genre)   // 카테고리별 배경음
  // 썸네일 공개는 이 화면에서 코인을 넣었을 때만 — 스와이프로 카드가 화면을 벗어나면 리셋(제목·캐릭터 복귀, 넣은 코인 티켓은 유지)
  const [revealedRaw, setRevealed] = useState(false)
  useEffect(() => {
    const el = rootRef.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setRevealed(false) }, { threshold: 0 })
    io.observe(el); return () => io.disconnect()
  }, [])
  // 코인을 넣으면 제목·캐릭터가 빠지고 썸네일이 또렷하게 드러난다
  const revealed = revealedRaw && !!game.thumbnail_url

  const creatorName = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
  const avatarUrl = avatarPreviewUrl(game.profiles?.avatar_config)
  const avatarFramesV = avatarFrames(game.profiles?.avatar_config)
  const teaser = lang === 'en'
    ? (game.teaser_en || T.games.teasers[hashOf(game.id) % T.games.teasers.length])
    : (game.teaser || (LOCAL_TEASERS as Record<string, string>)[game.id] || T.games.teasers[hashOf(game.id) % T.games.teasers.length])

  // 화면을 다시 열면 버튼은 항상 '코인 넣기' 로 시작한다 — 이미 낸 티켓이 있으면 다시 눌러도 차감 없이 바로 START
  const coinLock = useRef(false)
  const insertCoin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // 클릭 즉시 잠금 + 상태 전환 — 네트워크 대기 중 두 번 눌러도 한 번만 차감
    if (coinLock.current || coinState !== 'idle') return
    if (hasCoinTicket(game.id)) { setCoinState('ready'); setRevealed(true); return }
    coinLock.current = true
    setCoinState('drop'); setRevealed(true)
    // 소리는 탭한 그 순간(제스처 안)에 — await 뒤로 미루면 iOS 에서 재생이 막힐 수 있다
    playCoinSound()
    try {
      // 로컬 세션으로 로그인 판정(네트워크 왕복 없음) → 즉시 반응
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setCoinState('idle'); setRevealed(false); router.push('/login?redirect=/'); return }
      const { error } = await supabase.rpc('spend_credits_for_game', { p_game_id: game.id } as never)
      if (error) {
        if (/insufficient_vcoin|INSUFFICIENT_CREDITS/.test(error.message)) {
          alert(T.games.insufficientCoin)
          setCoinState('idle'); setRevealed(false)
          return
        }
        console.warn('vcoin spend skipped:', error.message)
      }
      try { sessionStorage.setItem(ticketKeyOf(game.id), String(Date.now())) } catch {}
    } finally { coinLock.current = false }
    setTimeout(() => setCoinState('ready'), 900)
  }

  const hue = useDominantHue(game.thumbnail_url) // 제목 색 = 썸네일 주요 색의 보색(배경과 대비되며 어울림)
  const startGame = (e: React.MouseEvent) => {
    e.stopPropagation()
    playStartSound()
    setTimeout(() => router.push(`/games/${game.id}`), 250)
  }

  const inner = (
    <>
      {/* 배경 — 게임 썸네일을 흐려 은은하게 */}
      <ThumbBackdrop src={game.thumbnail_url} alt={game.title} revealed={revealed} />
      {/* 싱글/멀티 라벨 — 상단 좌측 */}
      <div className="absolute top-4 left-4 right-16 z-10 flex items-center gap-2">
        <PlayModeBadge mode={game.play_mode} />
        <span className="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur pl-1 pr-2.5 py-1 text-white text-[12px] font-semibold max-w-[70%]">
          {game.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.thumbnail_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40" />
          )}
          <span className="truncate">🎮 {game.title}</span>
        </span>
      </div>
      {/* 조회수 랭킹 배지 — 상단 우측 */}
      {rank && rank <= 10 && (
        <span className={`absolute top-4 right-4 z-10 font-pixel text-[13px] px-3 py-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)] ${
          rank === 1 ? 'bg-[#c9940c] text-white' : rank === 2 ? 'bg-gray-300 text-[#241f17]' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-white/85 text-[#241f17]'
        }`}>
          #{rank}
        </span>
      )}
      {/* 상단 중앙 — Jua 포스터 타이틀 */}
      <div className="absolute inset-x-0 top-[16%] px-5 text-center z-[5]" style={{ ...{ opacity: revealed ? 0 : 1, transform: revealed ? 'translateY(-18px) scale(.9)' : 'none', transition: 'opacity .38s ease, transform .5s ease', pointerEvents: revealed ? 'none' : undefined }, '--ttl-glow': `hsl(${golden ? 42 : (322 + ((hashOf(game.id) >> 3) % 36) - 18 + 360) % 360} 95% 62% / .6)` } as React.CSSProperties}>
        <span className="relative inline-block feed-title-pop">
          <span className="relative inline-block feed-title-float" style={hue != null ? ({ '--th': Math.round((hue + 180) % 360) } as React.CSSProperties) : undefined}>
            <h3 className={`${galaxyFont.className} feed-title relative z-[1] text-[46px] leading-[1.2]`}>{teaser}</h3>
            <span aria-hidden className={`${galaxyFont.className} feed-title-chrome absolute inset-0 z-[2] text-[46px] leading-[1.2]`}>{teaser}</span>
          </span>
        </span>
      </div>
      {/* 방 디오라마 — 캐릭터는 중앙 (앱에서는 정적 렌더로 부드럽게) */}
      <div className="absolute inset-x-1 top-[30%] bottom-[20%] scale-[.84] origin-center" style={{ opacity: revealed ? 0 : 1, transform: revealed ? 'translateY(28px)' : 'none', transition: 'opacity .35s ease, transform .5s ease', pointerEvents: revealed ? 'none' : undefined }}>
        <RoomScene id={game.id} views={game.view_count ?? 0} avatar={avatarFramesV} />
      </div>
      {/* 우측 액션 레일 — 틱톡 스타일 */}
      <div className="absolute right-3 bottom-[38%] z-10 flex flex-col items-center gap-4">
        <div className="bg-white/85 rounded-full px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.12)]" onClick={e => e.stopPropagation()}>
          <LikeButton gameId={game.id} size="lg" />
        </div>
        <div className="flex flex-col items-center gap-0.5 text-white/85 drop-shadow">
          <ViewerIcon className="w-6 h-6" />
          <span className="text-[12px] font-bold">{formatViewers(game.view_count ?? 0)}</span>
        </div>
      </div>
      {/* 하단 정보 + 아케이드 코인 플로우 — 앱에서는 하단 내비와 겹치지 않게 더 위로 */}
      <div className={`absolute inset-x-0 bottom-0 z-10 px-5 pt-14 bg-gradient-to-t from-black/65 via-black/30 to-transparent ${isApp ? 'pb-28' : 'pb-24'}`}>
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <span className="avatar-ring" style={flagRingStyle(game.country ?? game.profiles?.country)}><span className="avatar-wave w-6 h-6 shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={creatorName} className="avatar-bob w-full h-full object-cover object-top" />
            ) : (
              <span className="font-pixel text-[10px] text-white">{creatorName.charAt(0).toUpperCase()}</span>
            )}
          </span></span>
          {creatorName}{countryFlag(game.country ?? game.profiles?.country) && <span className="ml-1">{countryFlag(game.country ?? game.profiles?.country)}</span>}
        </p>
        {game.intro && <p className="mt-1.5 text-[15px] font-bold leading-snug text-white line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]" style={{ wordBreak: 'keep-all' }}>{game.intro}</p>}
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
                <>✦ × {game.coin_cost ?? 1} 코인 넣기</>
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
    </>
  )

  return (
    <div
      ref={rootRef}
      className="feed-snap grain relative h-[100svh] overflow-hidden"
      style={auroraOf(game.id, golden)}
    >
      {/* 앱에서는 등장 애니메이션(Reveal) 없이 즉시 표시 → 스크롤 부드럽게 */}
      {isApp ? inner : <Reveal className="absolute inset-0">{inner}</Reveal>}
    </div>
  )
}
