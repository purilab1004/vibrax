'use client'

import { useRef } from 'react'
import Link from 'next/link'
import GameCard from '@/components/GameCard'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 넷플릭스식 가로 슬라이더 행 — 큰 카드가 한 줄에 2~3장만 보여 하나하나에 집중된다.
// 터치/트랙패드 스크롤 + 마우스 드래그 + 헤더 화살표 버튼 모두 지원.
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
    <section className="mb-12">
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
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-proximity -mx-6 px-6 pb-2 cursor-grab active:cursor-grabbing select-none"
      >
        {games.map(game => (
          <div
            key={game.id}
            className={`shrink-0 snap-start ${large ? 'w-[320px] sm:w-[420px] xl:w-[480px]' : 'w-[280px] sm:w-[360px] xl:w-[400px]'}`}
          >
            <GameCard
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

export default function LiveGrid({ games }: { games: GameWithCreator[] }) {
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
