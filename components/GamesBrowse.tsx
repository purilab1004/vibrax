'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  RoomScene, auroraOf, hashOf,
  hasCoinTicket, ticketKeyOf, playCoinSound, playStartSound,
} from '@/components/GameCard'
import FeedScreen from '@/components/home/FeedScreen'
import LikeButton from '@/components/LikeButton'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import LOCAL_TEASERS from '@/lib/teasers-local.json'
import { titleFont } from '@/lib/fonts'
import type { GameWithCreator } from '@/lib/supabase/types'
import { avatarPreviewUrl, avatarFrames } from '@/lib/jeumto/config'
import { useLiveBroadcasts } from '@/lib/live/useLiveBroadcasts'
import { countryFlag } from '@/lib/country'
import LiveCard from '@/components/LiveCard'
import { recordShare } from '@/lib/shares'

// 데스크톱 틱톡형 카드 — 중앙 세로 카드 + 우측 액션 레일
function DesktopFeedCard({ game, rank }: { game: GameWithCreator; rank?: number }) {
  const { T, lang } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'ready'>('idle')
  const [copied, setCopied] = useState(false)

  const creatorName = game.profiles?.agent_name ?? game.profiles?.username ?? 'unknown'
  const avatarUrl = avatarPreviewUrl(game.profiles?.avatar_config)
  const avatarFramesV = avatarFrames(game.profiles?.avatar_config)
  const teaser = lang === 'en'
    ? (game.teaser_en || T.games.teasers[hashOf(game.id) % T.games.teasers.length])
    : (game.teaser || (LOCAL_TEASERS as Record<string, string>)[game.id] || T.games.teasers[hashOf(game.id) % T.games.teasers.length])

  const insertCoin = async () => {
    if (coinState !== 'idle') return
    if (hasCoinTicket(game.id)) { setCoinState('ready'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?redirect=/games'); return }
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

  const startGame = () => {
    playStartSound()
    setTimeout(() => router.push(`/games/${game.id}`), 250)
  }

  const share = async () => {
    const url = `${window.location.origin}/games/${game.id}`
    recordShare(game.id)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
      {/* 세로 카드 */}
      <div
        className="grain relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)]"
        style={auroraOf(game.id, rank === 1 && (game.view_count ?? 0) > 0)}
      >
        {/* 랭킹 배지 */}
        {rank && rank <= 10 && (
          <span className={`absolute top-4 right-4 z-10 font-pixel text-[13px] px-3 py-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.25)] ${
            rank === 1 ? 'bg-[#c9940c] text-white' : rank === 2 ? 'bg-gray-300 text-[#241f17]' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-white/85 text-[#241f17]'
          }`}>
            #{rank}
          </span>
        )}
        {/* 상단 중앙 — Jua 포스터 타이틀 */}
        <div className="absolute inset-x-0 top-[15%] px-5 text-center z-[5]">
          <h3 className={`${titleFont.className} text-[42px] leading-[1.25] text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]`}>
            {teaser}
          </h3>
        </div>
        {/* 방 장면 — 캐릭터는 중앙 */}
        <div className="absolute inset-x-1 top-[23%] bottom-[27%]">
          <RoomScene id={game.id} views={game.view_count ?? 0} avatar={avatarFramesV} />
        </div>
        {/* 하단 — 아케이드 플로우 */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 pt-14 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
          <p className={`arcade-blink font-pixel text-[14px] tracking-[0.3em] ${
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
                  <span className="gold-coin absolute left-1/2 -top-6" style={{ ['--coin-drop' as string]: '31px' }} aria-hidden />
                  <span className="slot-spark absolute left-1/2 top-[8px] -translate-x-1/2 text-xs" aria-hidden>✨</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 우측 액션 레일 — 틱톡 스타일 */}
      <div className="flex flex-col items-center gap-5 self-end pb-8">
        {/* 제작자 아바타 */}
        <div className="flex flex-col items-center gap-1.5" title={creatorName}>
          <span className="avatar-ring shadow-[0_2px_10px_rgba(36,31,23,0.15)]"><span className="avatar-wave w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={creatorName} className="avatar-bob w-full h-full object-cover object-top" />
            ) : (
              <span className="font-pixel text-sm text-white">{creatorName.charAt(0).toUpperCase()}</span>
            )}
          </span></span>
          <span className="text-[11px] font-semibold text-[#6b6152] max-w-[72px] truncate">{countryFlag(game.country ?? game.profiles?.country) && <span className="mr-0.5">{countryFlag(game.country ?? game.profiles?.country)}</span>}{creatorName}</span>
        </div>
        {/* 좋아요 */}
        <div className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center">
          <LikeButton gameId={game.id} size="lg" />
        </div>
        {/* 조회수 */}
        <div className="flex flex-col items-center gap-0.5 text-[#6b6152]">
          <span className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center">
            <ViewerIcon className="w-5 h-5" />
          </span>
          <span className="text-[11px] font-bold">{formatViewers(game.view_count ?? 0)}</span>
        </div>
        {/* 공유 */}
        <div className="flex flex-col items-center gap-0.5 text-[#6b6152]">
          <button
            onClick={share}
            title="링크 복사"
            className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center hover:border-[#ec4899] hover:text-[#ec4899] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          </button>
          <span className="text-[11px] font-bold">{copied ? '복사됨!' : '공유'}</span>
        </div>
      </div>
    </div>
  )
}

// 게임 목록 — 모바일: 쇼츠 풀스크린 피드 / 데스크톱: 틱톡 웹형 중앙 카드 피드
export type FeedFilter = 'all' | 'video' | 'game'

// filter: all = 게임 사이에 라이브를 끼워 넣기, video = 라이브만, game = 게임만. shuffleLives = 라이브 순서를 랜덤으로
// pageScroll: 데스크톱에서 별도 스크롤 박스 대신 페이지 스크롤로 한 장씩 스냅 (홈 — 프롬프트 섹션을 넘기면 쇼츠 섹션으로 이어진다)
export default function GamesBrowse({ games: input, filter = 'all', shuffleLives = false, pageScroll = false, onOverscrollTop }: { games: GameWithCreator[]; filter?: FeedFilter; shuffleLives?: boolean; pageScroll?: boolean; onOverscrollTop?: () => void }) {
  const feedRef = useRef<HTMLDivElement>(null)
  // 방송 카드 — 게임 카드와 별개로 피드에 끼워 넣는다
  const liveMap = useLiveBroadcasts()
  const [seed] = useState(() => String(Math.random()))
  const livesAll = Object.values(liveMap)
  const lives = filter === 'game' ? [] : shuffleLives
    ? [...livesAll].sort((a, b) => hashOf(a.gameId + a.hostId + seed) - hashOf(b.gameId + b.hostId + seed))
    : livesAll
  const games = filter === 'video' ? [] : input
  // 라이브 카드를 몰아넣지 않고 게임 사이에 고르게 끼워 넣는다 (첫 번째는 맨 앞, 이후 게임 2~3장 간격)
  type Item = { kind: 'game'; game: GameWithCreator; rank?: number } | { kind: 'live'; live: (typeof lives)[number] }
  const items: Item[] = []
  {
    const gap = Math.max(2, Math.min(4, Math.floor(games.length / Math.max(1, lives.length))))
    let li = 0
    games.forEach((g, i) => {
      if (li < lives.length && i % gap === 0) items.push({ kind: 'live', live: lives[li++] })
      items.push({ kind: 'game', game: g, rank: i < 10 ? i + 1 : undefined })
    })
    while (li < lives.length) items.push({ kind: 'live', live: lives[li++] })
  }
  const liveKey = lives.map((l) => l.gameId).join(',')
  useEffect(() => {
    if (!liveKey) return
    if (feedRef.current) feedRef.current.scrollTo({ top: 0 })
    if (typeof window !== 'undefined' && window.scrollY < 200) window.scrollTo({ top: 0 })
  }, [liveKey])

  const jump = (dir: 1 | -1) => {
    if (pageScroll) { window.scrollBy({ top: dir * window.innerHeight, behavior: 'smooth' }); return }
    const el = feedRef.current
    if (!el) return
    if (dir === -1 && el.scrollTop <= 2 && onOverscrollTop) { onOverscrollTop(); return }
    el.scrollBy({ top: dir * el.clientHeight, behavior: 'smooth' })
  }
  // 첫 카드에서 위로 스크롤(휠/트랙패드)하면 위 섹션(홈: 프롬프트)으로 — 중첩 스크롤 박스에선 위로 잘 안 빠져나가는 문제 보완
  useEffect(() => {
    const el = feedRef.current
    if (!el || !onOverscrollTop) return
    let armed = true
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < -12 && el.scrollTop <= 2 && armed) { armed = false; onOverscrollTop(); setTimeout(() => { armed = true }, 900) }
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onOverscrollTop])

  return (
    <div>
      {items.length === 0 && (
        <div className="py-24 text-center text-[#857a68] text-sm">{filter === 'video' ? '지금 방송 중인 영상이 없어요.' : '표시할 게임이 없어요.'}</div>
      )}
      {/* 모바일: 한 화면 한 게임, 스와이프로 다음 */}
      <div className="md:hidden">
        {items.map((it) => it.kind === 'live'
          ? <LiveCard key={`live-${it.live.hostId}-${it.live.gameId}-${it.live.kind === 'link' ? it.live.src : 'cam'}`} live={it.live} game={games.find((g) => g.id === it.live.gameId) ?? null} layout="feed-mobile" />
          : <FeedScreen key={it.game.id} game={it.game} />)}
      </div>

      {/* 데스크톱: 중앙 세로 카드 + 우측 레일 + 위/아래 내비 */}
      <div className="hidden md:block relative">
        <div
          ref={feedRef}
          className={pageScroll
            ? 'md-page-feed'
            : 'h-[calc(100svh-3.75rem)] min-h-[540px] pt-1 pb-2 overflow-y-auto snap-y snap-mandatory scrollbar-hide'}
        >
          {items.map((it) => it.kind === 'live'
            ? <LiveCard key={`live-${it.live.hostId}-${it.live.gameId}-${it.live.kind === 'link' ? it.live.src : 'cam'}`} live={it.live} game={games.find((g) => g.id === it.live.gameId) ?? null} layout="feed-desktop" />
            : <DesktopFeedCard key={it.game.id} game={it.game} rank={it.rank} />)}
        </div>
        {/* 위/아래 화살표 — 다음/이전 게임 */}
        <div className={`${pageScroll ? 'fixed' : 'absolute'} right-2 lg:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30`}>
          {([[-1, 'M6 15l6-6 6 6'], [1, 'M6 9l6 6 6-6']] as const).map(([dir, d]) => (
            <button
              key={dir}
              onClick={() => jump(dir)}
              aria-label={dir === 1 ? 'next game' : 'previous game'}
              className="w-11 h-11 rounded-full bg-white border border-[#ebe4d6] shadow-[0_4px_14px_rgba(36,31,23,0.12)] text-[#6b6152] hover:text-[#2563eb] hover:border-[#2563eb]/50 flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
