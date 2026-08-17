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
  game?: Pick<Game, 'id' | 'title' | 'thumbnail_url'> | null
  layout: 'feed-mobile' | 'feed-desktop' | 'tile'
}

export default function LiveCard({ live, game: given, layout }: Props) {
  const router = useRouter()
  const [game, setGame] = useState<Pick<Game, 'id' | 'title' | 'thumbnail_url'> | null>(given ?? null)
  useEffect(() => {
    if (given) return
    let alive = true
    createClient().from('games').select('id,title,thumbnail_url').eq('id', live.gameId).maybeSingle().then(({ data }) => { if (alive && data) setGame(data as Game) })
    return () => { alive = false }
  }, [given, live.gameId])

  const go = () => router.push(`/games/${live.gameId}`)

  const inner = (
    <>
      {/* 영상 — 카드 가득 */}
      <div className="absolute inset-0 bg-black">
        <LiveView live={live} cover />
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
      <div className="absolute inset-x-0 bottom-0 p-4 pt-14 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        {game && (
          <div className="flex items-center gap-2.5 mb-3">
            {game.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.thumbnail_url} alt="" className="w-12 h-8 rounded object-cover shrink-0 ring-1 ring-white/40" />
            )}
            <div className="min-w-0">
              <p className="font-pixel text-[9px] text-white/60 tracking-widest">지금 방송 중인 게임</p>
              <p className={`${titleFont.className} text-white text-[18px] leading-tight truncate`}>{game.title}</p>
            </div>
          </div>
        )}
        <button
          onClick={go}
          className={`w-full h-[52px] ${titleFont.className} text-[21px] rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] shadow-[0_5px_0_#d18f00,0_9px_16px_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#d18f00] transition-all flex items-center justify-center gap-2`}
        >
          🪙 코인 넣고 플레이 →
        </button>
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
