'use client'
// 홈 — 프롬프트(히어로) 아래: /games 처럼 한 장씩 스크롤하는 피드 + 좌측 필터(전체/영상/게임).
// (이전 핀터레스트 매소너리는 카드를 한꺼번에 다 그려 무거웠다)
import { useEffect, useRef, useState } from 'react'
import MobileGamesTools from '@/components/MobileGamesTools'
import GamesBrowse, { type FeedFilter } from '@/components/GamesBrowse'
import type { GameWithCreator } from '@/lib/supabase/types'

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'video', label: '영상' },
  { key: 'game', label: '게임' },
]

export default function HomeFeed({ games }: { games: GameWithCreator[] }) {
  const [filter, setFilter] = useState<FeedFilter>('all')
  const sorted = [...games].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  // 데스크톱: 프롬프트(히어로) 섹션을 넘기면 쇼츠 섹션으로 한 장씩 스냅되도록 html 에 스냅을 켠다
  useEffect(() => {
    document.documentElement.classList.add('home-snap')
    return () => document.documentElement.classList.remove('home-snap')
  }, [])
  // 모바일: 피드 구간에 들어왔을 때만 우상단 검색 아이콘 표시 (히어로에선 숨김)
  const rootRef = useRef<HTMLDivElement>(null)
  const [inFeed, setInFeed] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => setInFeed(es.some((e) => e.isIntersecting)), { rootMargin: '-40% 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const pills = (close: () => void) => (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 backdrop-blur-xl border border-[#ebe4d6] p-1.5">
      {FILTERS.map((f) => (
        <button key={f.key} onClick={() => { setFilter(f.key); close() }}
          className={`font-pixel text-[11px] tracking-wider px-4 py-2 rounded-full transition-all ${filter === f.key ? 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white' : 'text-[#6b6152]'}`}>
          {f.label}
        </button>
      ))}
    </div>
  )
  return (
    // 데스크톱: 히어로 다음 한 화면짜리 스냅 섹션 안에 /games 와 똑같은 피드 박스(헤더 높이만큼 뺀 높이)를 둔다
    <div ref={rootRef} className="w-full md:h-[100svh] md:pt-[3.75rem] md:box-border feed-snap">
      {/* 모바일 — /games 처럼 우상단 검색 아이콘 → 패널(검색은 /games 로 이동, 카테고리 = 전체/영상/게임) */}
      <MobileGamesTools categories={pills} visible={inFeed} />
      <div className="md:flex md:gap-6 md:px-6">
        {/* 데스크톱 — 좌측 필터 사이드바 (/games 와 같은 문법). 페이지 스크롤이라 sticky 로 따라온다 */}
        <aside className="hidden md:block w-52 shrink-0 sticky top-20 self-start z-20">
          <nav className="flex flex-col" aria-label="home feed filter">
            <p className="font-pixel text-[10px] text-[#9d9280] tracking-[0.25em] px-3 mb-2">FEED</p>
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-left px-3 py-2.5 rounded-lg text-[14px] font-bold tracking-wide transition-colors ${filter === f.key ? 'text-[#2563eb] bg-[#2563eb]/10' : 'text-[#4a4337] hover:text-[#2563eb] hover:bg-[#241f17]/5'}`}>
                {f.label}
              </button>
            ))}
          </nav>
          {/* 축약 푸터 — 사이드 메뉴 하단 (홈은 페이지 푸터를 숨긴다) */}
          <div className="mt-6 border-t border-[#ebe4d6] pt-4 px-3 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[['/games', 'GAMES'], ['/studio', 'STUDIO'], ['/tournament', 'TOURNAMENT'], ['/blog', 'BLOG'], ['/partner', 'PARTNER'], ['/about', 'ABOUT']].map(([href, label]) => (
                <a key={href} href={href} className="text-[12px] text-[#6b6152] hover:text-[#2563eb]">{label}</a>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              <a href="/terms" className="text-[11px] text-[#9d9280] hover:text-[#2563eb]">이용약관</a>
              <a href="/privacy" className="text-[11px] text-[#9d9280] hover:text-[#2563eb]">개인정보처리방침</a>
              <a href="/refund" className="text-[11px] text-[#9d9280] hover:text-[#2563eb]">환불정책</a>
            </div>
            <a href="mailto:dev@puritechlab.com" className="text-[11px] text-[#9d9280] hover:text-[#2563eb]">dev@puritechlab.com</a>
            <p className="font-pixel text-[9px] text-[#b3a78f] tracking-widest mt-1">© {new Date().getFullYear()} VIBREXCUP · <a href="https://puritechlab.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#2563eb]">PuriTechLab</a></p>
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <GamesBrowse games={sorted} filter={filter} shuffleLives onOverscrollTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </div>
      </div>
    </div>
  )
}
