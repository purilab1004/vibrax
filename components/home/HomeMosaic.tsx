'use client'

import { useRef } from 'react'
import Link from 'next/link'
import GameCard from '@/components/GameCard'
import Reveal from '@/components/Reveal'
import { useLang } from '@/lib/i18n/context'
import type { GameWithCreator, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

// 장르별 섹션 — 각 섹션은 오버레이 타일(higgsfield)의 가로 슬라이더(넷플릭스).
// 터치/트랙패드 스크롤 + 마우스 드래그 + 헤더 화살표 버튼 지원.
function Row({ heading, headerExtra, games, large, leading }: {
  heading: React.ReactNode
  headerExtra?: React.ReactNode
  games: GameWithCreator[]
  large?: boolean
  leading?: React.ReactNode
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
      className="w-8 h-8 flex items-center justify-center border border-[#ebe4d6] text-[#6b6152] hover:text-[#2563eb] hover:border-[#2563eb] transition-colors text-sm"
    >
      {glyph}
    </button>
  )

  return (
    <section className="mb-14">
      <Reveal className="flex items-center justify-between mb-5 gap-3">
        {heading}
        <div className="flex items-center gap-3">
          {headerExtra}
          <div className="hidden md:flex gap-1.5">
            {arrowBtn(-1, '‹')}
            {arrowBtn(1, '›')}
          </div>
        </div>
      </Reveal>
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-proximity pb-2 cursor-grab active:cursor-grabbing select-none"
      >
        {leading && (
          <Reveal
            delay={80}
            className={`shrink-0 snap-start ${large ? 'w-[320px] sm:w-[440px] xl:w-[520px]' : 'w-[280px] sm:w-[360px] xl:w-[420px]'}`}
          >
            {leading}
          </Reveal>
        )}
        {games.map((game, gi) => (
          <Reveal
            key={game.id}
            delay={Math.min((gi + (leading ? 2 : 1)) * 90, 540)}
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
          </Reveal>
        ))}
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
          <h2 className="font-pixel text-xl text-[#241f17] tracking-wide flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {T.games.liveNow}
          </h2>
        }
        games={topLive}
        leading={
          <Link
            href="/studio"
            className="group flex flex-col items-center justify-center gap-3 aspect-video w-full rounded-xl border-2 border-dashed border-[#cfc4ab] bg-white/60 hover:border-[#2563eb] hover:bg-white transition-colors"
          >
            {/* 동그라미 + 아이콘 */}
            <span className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] flex items-center justify-center shadow-[0_6px_20px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-sm md:text-base font-bold text-[#4a4337] group-hover:text-[#2563eb] transition-colors text-center px-4">
              {T.games.beNextHero}
            </span>
          </Link>
        }
      />
      {GENRES.map(g => (
        <Row
          key={g}
          heading={
            <h2 className="font-pixel text-xl text-[#2563eb] tracking-wide">{T.genres[g]}</h2>
          }
          headerExtra={
            <Link
              href={`/games?genre=${g}`}
              className="text-[13px] text-[#6b6152] hover:text-[#2563eb] transition-colors tracking-wider"
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
