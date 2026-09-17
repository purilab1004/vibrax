'use client'
// 방송 카드 — 게임 카드와 별개로 피드에 끼어드는 LIVE 카드. 영상이 크게 재생되고,
// "코인 넣고 플레이"를 누르면 추천 게임 페이지로 간다.
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import type { LiveEntry } from '@/lib/live/useLiveBroadcasts'
import { titleFont } from '@/lib/fonts'
import { countryFlag, flagRingStyle } from '@/lib/country'
import { useIsNativeApp } from '@/lib/isNativeApp'
const LiveView = dynamic(() => import('@/components/CameraBjView').then((m) => m.LiveView), { ssr: false })

interface Props {
  live: LiveEntry
  game?: Pick<Game, 'id' | 'title' | 'thumbnail_url' | 'coin_cost'> | null
  layout: 'feed-mobile' | 'feed-desktop' | 'tile'
}

export default function LiveCard({ live, game: given, layout }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<Pick<Game, 'id' | 'title' | 'thumbnail_url' | 'coin_cost'> | null>(given ?? null)
  const hasGame = !!live.gameId // 게임 연결 없이 공유한 영상은 코인/게임 버튼을 보이지 않는다
  useEffect(() => {
    if (given || !live.gameId) return
    let alive = true
    createClient().from('games').select('id,title,thumbnail_url,coin_cost').eq('id', live.gameId).maybeSingle().then(({ data }) => { if (alive && data) setGame(data as Game) })
    return () => { alive = false }
  }, [given, live.gameId])

  const [coin, setCoin] = useState<'idle' | 'drop' | 'ready'>('idle')
  const [copied, setCopied] = useState(false)
  // 플레이어(iframe/WebRTC)는 카드가 화면 근처(±1화면)에 올 때만 마운트 — 모바일에서 iframe 여러 개로 튕기는 것 방지 + 보이는 것부터 빨리 로드
  const rootRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => setNear(es.some((e) => e.isIntersecting)), { rootMargin: '100% 0px 100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const go = () => router.push(`/games/${live.gameId}`)
  // 코인 투입 연출 → START → 게임 페이지 (실제 코인 차감은 게임 페이지의 기존 흐름에서)
  const insert = () => { if (coin !== 'idle') return; setCoin('drop'); setTimeout(() => setCoin('ready'), 900) }
  const isVideo = live.kind === 'link' && !!live.video // 라이브가 아닌 일반 영상 공유
  const isApp = useIsNativeApp()

  const inner = (
    <>
      {/* 영상 — 카드 가득 */}
      <div className="absolute inset-0 bg-black">
        {/* 모바일 /games 는 우상단에 검색 아이콘이 떠 있으니 스피커를 그 아래로 */}
        {live.kind === 'camera' ? (
          /* 회원 라이브(폰 카메라·게임 화면) — 카드는 게임 썸네일 + LIVE. 영상은 게임에 들어가서(START) 본다 */
          <div className="absolute inset-0">
            {game?.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.thumbnail_url} alt={game.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0f172a]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
            <div className="absolute inset-x-0 top-[38%] flex flex-col items-center gap-2 text-white">
              <span className="flex items-center gap-2 rounded-full bg-[#e11d48] px-4 py-1.5 font-pixel text-[11px] tracking-widest shadow-[0_0_24px_rgba(225,29,72,.7)]"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE</span>
              <span className="text-[13px] font-semibold drop-shadow">{live.screen ? `${live.hostName} 님이 플레이 중 — 들어가서 관전` : `${live.hostName} 님이 방송 중`}</span>
            </div>
          </div>
        ) : near ? (
          <LiveView live={live} cover badge={false} controls controlsClass={layout === 'feed-mobile' ? 'left-3 top-[calc(3.1rem+var(--st,0px))]' : 'left-3 top-12'} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 font-pixel text-[10px] tracking-widest">{isVideo ? 'VIDEO' : 'LIVE'}</div>
        )}
      </div>
      {/* 상단 — 방송자 */}
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
        {isVideo
          ? <span className="flex items-center gap-1.5 rounded-full bg-[#7c3aed] text-white font-pixel text-[10px] px-2.5 py-1 tracking-widest shadow">▶ VIDEO</span>
          : <span className="flex items-center gap-1.5 rounded-full bg-[#e11d48] text-white font-pixel text-[10px] px-2.5 py-1 tracking-widest shadow"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE</span>}
        {isVideo && hasGame && game && (
          /* 영상 카드 — VIDEO 옆에 연결된 게임 썸네일·이름 */
          <span className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur pl-1 pr-2.5 py-1 text-white text-[12px] font-semibold max-w-[62%]">
            {game.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.thumbnail_url} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40" />
            )}
            <span className="truncate">🎮 {game.title}</span>
          </span>
        )}
        {!isVideo && <span className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2 py-1 text-white text-[12px] font-semibold max-w-[60%]">
          {live.hostAvatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={live.hostAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover bg-white/70" />
          )}
          <span className="truncate">{live.hostName}</span>
        </span>}
      </div>
      {/* 하단 — 추천 게임 + 코인 넣고 플레이 */}
      {/* 모바일 피드는 하단 내비에 가리지 않게 게임 카드와 같은 여백(pb-24) */}
      <div className={`absolute inset-x-0 bottom-0 pt-24 bg-gradient-to-t from-black/95 via-black/70 to-transparent ${layout === 'feed-mobile' ? (isApp ? 'px-5 pb-28' : 'px-5 pb-24') : 'px-6 pb-6'}`}>
        {/* 게임 카드의 제작자 줄과 같은 높이의 한 줄 — 어떤 게임인지 */}
        {hasGame && !isVideo ? <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80 mb-3 min-h-[20px]">
          {game?.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.thumbnail_url} alt="" className="w-7 h-5 rounded object-cover shrink-0 ring-1 ring-white/40" />
          )}
          <span className="truncate">🎮 {game?.title ?? '방송 중인 게임'}</span>
        </p> : (
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80 min-h-[20px]">
            <span className="avatar-ring" style={flagRingStyle(live.hostCountry)}><span className="avatar-wave w-6 h-6 shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center bg-white/20">
              {live.hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={live.hostAvatarUrl} alt={live.hostName} className="avatar-bob w-full h-full object-cover object-top" />
              ) : (
                <span className="font-pixel text-[10px] text-white">{live.hostName.charAt(0).toUpperCase()}</span>
              )}
            </span></span>
            <span className="truncate">{live.hostName}</span>{countryFlag(live.hostCountry) && <span className="ml-1">{countryFlag(live.hostCountry)}</span>}
          </p>
        )}
        {live.videoTitle && <p className="mt-1.5 text-[15px] font-bold leading-snug text-white line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]" style={{ wordBreak: 'keep-all' }}>{live.videoTitle}</p>}
        {live.note && <p className="mt-1 text-[13px] leading-snug text-white/90 line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]" style={{ wordBreak: 'keep-all' }}>{live.note}</p>}

        {hasGame && <>
        {/* 게임 카드와 같은 INSERT COIN + 코인 넣기 + 코인 통 — 누르면 코인 투입 연출 후 게임 페이지로 */}
        <div className="mt-2 flex items-center gap-3">
          {coin !== 'ready' ? (
            <button
              onClick={insert}
              disabled={coin === 'drop'}
              className={`flex-1 h-[52px] ${titleFont.className} text-[21px] rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#d18f00] transition-all flex items-center justify-center gap-2 disabled:opacity-90`}
            >
              {coin === 'drop' ? '코인 투입 중...' : <>🪙 × {game?.coin_cost ?? 1} 코인 넣기</>}
            </button>
          ) : (
            <button
              onClick={go}
              className="flex-1 h-[52px] rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[17px] tracking-widest shadow-[inset_0_2px_5px_rgba(255,255,255,0.35),0_5px_0_#8f1508,0_10px_18px_rgba(0,0,0,0.5)] active:translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              ▶ START
            </button>
          )}
          <div className="relative w-12 h-[58px] shrink-0">
            <div className={`w-full h-full rounded-lg bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-1.5 transition-shadow ${coin === 'ready' ? 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_0_16px_rgba(76,255,106,0.5)]' : ''} ${coin === 'drop' ? 'slot-clink' : ''}`}>
              <span className="w-1.5 h-7 rounded-full bg-black shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]" />
              <span className={`w-2.5 h-2.5 rounded-full ${coin === 'ready' ? 'bg-[#4cff6a] shadow-[0_0_8px_#4cff6a]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
            </div>
            {coin === 'drop' && (
              <>
                <span className="gold-coin absolute left-1/2 -top-6" style={{ '--coin-drop': '31px' } as React.CSSProperties} aria-hidden />
                <span className="slot-spark absolute left-1/2 top-[8px] -translate-x-1/2 text-xs" aria-hidden>✨</span>
              </>
            )}
          </div>
        </div>
        </>}
      </div>
    </>
  )

  if (layout === 'feed-mobile') {
    return <div ref={rootRef} className="feed-snap relative h-[100svh] overflow-hidden bg-black">{inner}</div>
  }
  if (layout === 'feed-desktop') {
    return (
      <div ref={rootRef} className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
        <div className="relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)] bg-black">{inner}</div>
        {/* 우측 레일 — 게임 카드와 같은 폭/위치(방송자 · 게임 보기 · 공유)로 카드 정렬을 맞춘다 */}
        <div className="flex flex-col items-center gap-5 self-end pb-8">
          <div className="flex flex-col items-center gap-1.5" title={live.hostName}>
            <span className="avatar-ring shadow-[0_2px_10px_rgba(36,31,23,0.15)]"><span className="avatar-wave w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
              {live.hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={live.hostAvatarUrl} alt={live.hostName} className="avatar-bob w-full h-full object-cover object-top" />
              ) : (
                <span className="font-pixel text-sm text-white">{live.hostName.charAt(0).toUpperCase()}</span>
              )}
            </span></span>
            <span className="text-[11px] font-semibold text-[#6b6152] max-w-[72px] truncate">{live.hostName}</span>
          </div>
          <div className={`flex flex-col items-center gap-0.5 ${isVideo ? 'text-[#7c3aed]' : 'text-[#e11d48]'}`}>
            <span className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center">
              {isVideo ? <span className="text-[13px]">▶</span> : <span className="w-2.5 h-2.5 rounded-full bg-[#e11d48] animate-pulse" />}
            </span>
            <span className="text-[11px] font-bold">{isVideo ? 'VIDEO' : 'LIVE'}</span>
          </div>
          {hasGame && <div className="flex flex-col items-center gap-0.5 text-[#6b6152]">
            <button onClick={go} title="게임 보기" className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="11" rx="3" /><path d="M8 11v4M6 13h4M15 12h.01M17.5 14h.01" /></svg>
            </button>
            <span className="text-[11px] font-bold">게임</span>
          </div>}
          <div className="flex flex-col items-center gap-0.5 text-[#6b6152]">
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(hasGame ? `${window.location.origin}/games/${live.gameId}` : `${window.location.origin}/games`); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {} }}
              title="링크 복사"
              className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center hover:border-[#ec4899] hover:text-[#ec4899] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
            <span className="text-[11px] font-bold">{copied ? '복사됨!' : '공유'}</span>
          </div>
        </div>
      </div>
    )
  }
  return <div ref={rootRef} className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(36,31,23,0.18)] bg-black">{inner}</div>
}
