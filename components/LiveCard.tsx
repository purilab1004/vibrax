'use client'
// 방송 카드 — 게임 카드와 별개로 피드에 끼어드는 LIVE 카드. 영상이 크게 재생되고,
// "코인 넣고 플레이"를 누르면 추천 게임 페이지로 간다.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import type { LiveEntry } from '@/lib/live/useLiveBroadcasts'
import { titleFont } from '@/lib/fonts'
const LiveView = dynamic(() => import('@/components/CameraBjView').then((m) => m.LiveView), { ssr: false })

interface Props {
  live: LiveEntry
  game?: Pick<Game, 'id' | 'title' | 'thumbnail_url' | 'coin_cost'> | null
  layout: 'feed-mobile' | 'feed-desktop' | 'tile'
}

export default function LiveCard({ live, game: given, layout }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<Pick<Game, 'id' | 'title' | 'thumbnail_url' | 'coin_cost'> | null>(given ?? null)
  useEffect(() => {
    if (given) return
    let alive = true
    createClient().from('games').select('id,title,thumbnail_url,coin_cost').eq('id', live.gameId).maybeSingle().then(({ data }) => { if (alive && data) setGame(data as Game) })
    return () => { alive = false }
  }, [given, live.gameId])

  const [coin, setCoin] = useState<'idle' | 'drop' | 'ready'>('idle')
  const go = () => router.push(`/games/${live.gameId}`)
  // 코인 투입 연출 → START → 게임 페이지 (실제 코인 차감은 게임 페이지의 기존 흐름에서)
  const insert = () => { if (coin !== 'idle') return; setCoin('drop'); setTimeout(() => setCoin('ready'), 900) }

  const inner = (
    <>
      {/* 영상 — 카드 가득 */}
      <div className="absolute inset-0 bg-black">
        {/* 모바일 /games 는 우상단에 검색 아이콘이 떠 있으니 스피커를 그 아래로 */}
        <LiveView live={live} cover badge={false} controls controlsClass={layout === 'feed-mobile' ? 'top-16 right-3' : 'top-3 right-3'} />
      </div>
      {/* 상단 — 방송자 */}
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
        <span className="flex items-center gap-1.5 rounded-full bg-[#e11d48] text-white font-pixel text-[10px] px-2.5 py-1 tracking-widest shadow"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />LIVE</span>
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2 py-1 text-white text-[12px] font-semibold max-w-[60%]">
          {live.hostAvatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={live.hostAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover bg-white/70" />
          )}
          <span className="truncate">{live.hostName}</span>
        </span>
      </div>
      {/* 하단 — 추천 게임 + 코인 넣고 플레이 */}
      {/* 모바일 피드는 하단 내비에 가리지 않게 게임 카드와 같은 여백(pb-24) */}
      <div className={`absolute inset-x-0 bottom-0 pt-14 bg-gradient-to-t from-black/85 via-black/40 to-transparent ${layout === 'feed-mobile' ? 'px-5 pb-24' : 'px-6 pb-6'}`}>
        {/* 게임 카드의 제작자 줄과 같은 높이의 한 줄 — 어떤 게임인지 */}
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80 mb-3 min-h-[20px]">
          {game?.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.thumbnail_url} alt="" className="w-7 h-5 rounded object-cover shrink-0 ring-1 ring-white/40" />
          )}
          <span className="truncate">🎮 {game?.title ?? '방송 중인 게임'}</span>
        </p>
        {/* 게임 카드와 같은 INSERT COIN + 코인 넣기 + 코인 통 — 누르면 코인 투입 연출 후 게임 페이지로 */}
        <p className={`arcade-blink font-pixel text-[14px] tracking-[0.3em] ${coin === 'ready' ? 'text-[#4cff6a] drop-shadow-[0_0_6px_rgba(76,255,106,0.7)]' : 'text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]'}`}>
          {coin === 'ready' ? 'PRESS START' : 'INSERT COIN'}
        </p>
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
      </div>
    </>
  )

  if (layout === 'feed-mobile') {
    return <div className="feed-snap relative h-[100svh] overflow-hidden bg-black">{inner}</div>
  }
  if (layout === 'feed-desktop') {
    return (
      <div className="h-full snap-start [scroll-snap-stop:always] flex items-center justify-center gap-5">
        <div className="relative h-[96%] aspect-[9/15] rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(36,31,23,0.22)] bg-black">{inner}</div>
      </div>
    )
  }
  return <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(36,31,23,0.18)] bg-black">{inner}</div>
}
