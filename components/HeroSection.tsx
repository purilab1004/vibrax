'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'
import HeroAvatarMarquee from '@/components/HeroAvatarMarquee'
import type { GameWithCreator } from '@/lib/supabase/types'

// tropica가 먼저, vecto가 다음
const VIDEOS = ['/hero-bg-2.mp4', '/hero-bg.mp4']
const ROTATE_MS = 14000

// 히어로 — linearity.io 컨셉: 풀 뷰포트 첫 화면, 배경 영상 로테이션, 하단 TOP AI AVATAR 마퀴
export default function HeroSection({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const [line1, line2] = T.hero.promptHeading.split('\n')
  const [vid, setVid] = useState(0)

  // 두 영상을 크로스페이드로 로테이션
  useEffect(() => {
    const t = setInterval(() => setVid(v => (v + 1) % VIDEOS.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [])


  return (
    <section className="feed-snap relative overflow-hidden -mt-14 pt-14 min-h-[100svh] flex flex-col bg-white">
      {/* 배경 영상 — 상단 10% 아래에서 시작, 활성 영상만 보이고 1.5초 크로스페이드 */}
      {VIDEOS.map((src, i) => (
        <video
          key={src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
            vid === i ? 'opacity-55' : 'opacity-0'
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload={i === 0 ? 'auto' : 'metadata'}
          aria-hidden
        >
          <source src={src} type="video/mp4" />
        </video>
      ))}
      {/* 보호 오버레이 — 위·중간(프롬프트까지) 흰색, 좌우 가장자리는 영상이 살짝 비친다 */}
      <div className="hero-shield absolute inset-0" aria-hidden />
      {/* 하단 페이드 — 본문 배경색으로 자연스럽게 연결 */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#fcfaf5]" aria-hidden />

      {/* 파랑·초록·노랑 글로우 — 서로 다른 궤적과 속도로 떠다닌다 */}
      <div className="hero-glow hero-glow-blue" aria-hidden />
      <div className="hero-glow hero-glow-green" aria-hidden />
      <div className="hero-glow hero-glow-yellow" aria-hidden />

      {/* 중앙 블록 — 헤드라인 + 프롬프트 카드 */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center py-10">
        <h1 className="hero-chat-in text-3xl md:text-5xl leading-[1.15] tracking-tight font-extrabold text-[#241f17] mb-5">
          {line1}
          {line2 && (
            <>
              <br />
              <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">
                {line2}
              </span>
            </>
          )}
        </h1>

        {/* 대시 서브라벨 — ─── 태그라인 ─── */}
        <div className="flex items-center gap-3 mb-9 w-full max-w-md">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#cfc4ab]" />
          <span className="text-[11px] font-semibold tracking-[0.22em] text-[#857a68] whitespace-nowrap">
            {T.hero.tagline}
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#cfc4ab]" />
        </div>

        <HeroPromptInput />
      </div>

      {/* 하단 — TOP AI AVATAR 마퀴 + 스크롤 유도 */}
      <div className="relative w-full pb-5 space-y-4">
        <HeroAvatarMarquee games={games} />
        <div className="flex flex-col items-center gap-1 text-[#b3a78f]" aria-hidden>
          <span className="text-[9px] font-semibold tracking-[0.3em]">SCROLL</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
    </section>
  )
}
