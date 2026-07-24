'use client'

import { useRef } from 'react'
import Link from 'next/link'
import GameCard from '@/components/GameCard'
import ViewerIcon from '@/components/ViewerIcon'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 장르별 섹션 — 각 섹션은 오버레이 타일(higgsfield)의 가로 슬라이더(넷플릭스).
// 터치/트랙패드 스크롤 + 마우스 드래그 + 헤더 화살표 버튼 지원.
function Row({ heading, headerExtra, games, large }: {
  heading: React.ReactNode
  headerExtra?: React.ReactNode
  games: GameWithCreator[]
  large?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false })

  if (games.length === 0) return null

  const scrollByDir = (dir: 1 | -1) =>
    track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' })

  // 마우스 드래그로 슬라이드 — 드래그였다면 카드 클릭(플레이)은 무시
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !track.current) return
    drag.current = { down: true, startX: e.clientX, scrollLeft: track.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.down || !track.current) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 5) drag.current.moved = true
    track.current.scrollLeft = drag.current.scrollLeft - dx
  }
  const endDrag = () => { drag.current.down = false }
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  const arrowBtn = (dir: 1 | -1, glyph: string) => (
    <button
      onClick={() => scrollByDir(dir)}
      aria-label={dir === 1 ? 'scroll right' : 'scroll left'}
      className="w-8 h-8 flex items-center justify-center border border-gray-800 text-gray-400 hover:text-[#00ff41] hover:border-[#00ff41] transition-colors text-sm"
    >
      {glyph}
    </button>
  )

  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-5 gap-3">
        {heading}
        <div className="flex items-center gap-3">
          {headerExtra}
          <div className="hidden md:flex gap-1.5">
            {arrowBtn(-1, '‹')}
            {arrowBtn(1, '›')}
          </div>
        </div>
      </div>
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-proximity -mx-6 px-6 pb-2 cursor-grab active:cursor-grabbing select-none"
      >
        {games.map(game => (
          <div
            key={game.id}
            className={`shrink-0 snap-start ${large ? 'w-[320px] sm:w-[440px] xl:w-[520px]' : 'w-[280px] sm:w-[360px] xl:w-[420px]'}`}
          >
            <GameCard
              variant="tile"
              game={game}
              creatorName={game.profiles?.agent_name ?? game.profiles?.username ?? null}
              creatorAvatarUrl={game.profiles?.avatar_config?.previewUrl ?? null}
              creatorCountry={game.profiles?.country ?? null}
              bjAvatarConfig={game.profiles?.avatar_config ?? null}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// 순위 강조 — 금/은/동 링과 배지
const RANK_STYLE = [
  { ring: 'ring-2 ring-[#ffd24d] shadow-[0_0_24px_rgba(255,210,77,0.35)]', badge: 'bg-[#ffd24d] text-black' },
  { ring: 'ring-2 ring-gray-300', badge: 'bg-gray-300 text-black' },
  { ring: 'ring-2 ring-amber-600', badge: 'bg-amber-600 text-black' },
] as const

interface Creator {
  id: string
  name: string
  avatarUrl: string | null
  games: number
  views: number
}

// 제작자 랭킹 — 게임 개수 우선, 동률이면 총 조회수
function topCreatorsOf(games: GameWithCreator[]): Creator[] {
  const map = new Map<string, Creator>()
  for (const g of games) {
    const cur = map.get(g.user_id) ?? {
      id: g.user_id,
      name: g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown',
      avatarUrl: g.profiles?.avatar_config?.previewUrl ?? null,
      games: 0,
      views: 0,
    }
    cur.games += 1
    cur.views += g.view_count ?? 0
    map.set(g.user_id, cur)
  }
  return [...map.values()]
    .sort((a, b) => b.games - a.games || b.views - a.views)
    .slice(0, 10)
}

function TopCreators({ games, heading }: { games: GameWithCreator[]; heading: string }) {
  const { T } = useLang()
  const creators = topCreatorsOf(games)
  if (creators.length === 0) return null
  return (
    <section className="mb-14">
      <h2 className="font-pixel text-sm text-[#ffd24d] tracking-widest mb-5">🏆 {heading}</h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-6 px-6 pt-2 pb-3">
        {creators.map((cr, i) => {
          const rank = RANK_STYLE[i]
          return (
            <div key={cr.id} className="shrink-0 w-[150px] sm:w-[170px]">
              <div className={`relative aspect-[3/4] rounded-xl overflow-hidden bg-[#111] border border-gray-800 ${rank ? rank.ring : ''}`}>
                {cr.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.avatarUrl} alt={cr.name} className="avatar-idle w-full h-full object-cover object-top" style={{ animationDelay: `${i * 0.6}s` }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-pixel text-3xl text-gray-700">{cr.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className={`absolute top-2 left-2 font-pixel text-[11px] px-2 py-1 rounded ${rank ? rank.badge : 'bg-black/70 text-gray-300'}`}>
                  #{i + 1}
                </span>
              </div>
              <p className="mt-2.5 text-sm font-semibold text-white truncate">{cr.name}</p>
              <p className="text-[13px] text-gray-500 flex items-center gap-1.5">
                {T.games.gamesCount(cr.games)}
                <span className="text-gray-700">·</span>
                <ViewerIcon className="w-3.5 h-3.5" />
                {formatViewers(cr.views)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function HomeMosaic({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()

  const topLive = [...games]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 8)

  return (
    <div>
      <Row
        large
        heading={
          <h2 className="font-pixel text-sm text-white tracking-widest flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {T.games.liveNow}
          </h2>
        }
        games={topLive}
      />
      <TopCreators games={games} heading={T.games.topCreators} />
      {GENRES.map(g => (
        <Row
          key={g}
          heading={
            <h2 className="font-pixel text-sm text-[#00ff41] tracking-widest">{T.genres[g]}</h2>
          }
          headerExtra={
            <Link
              href={`/games?genre=${g}`}
              className="text-[13px] text-gray-400 hover:text-[#00ff41] transition-colors tracking-wider"
            >
              {T.games.viewAll}
            </Link>
          }
          games={games.filter(x => x.genre === g)}
        />
      ))}
    </div>
  )
}
