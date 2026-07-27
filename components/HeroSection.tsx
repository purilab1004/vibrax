'use client'

import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'

// 히어로 = 로고를 실물 크기로 — 강렬한 파란 하늘, 모래 언덕, 야자수 (로고와 동일한 색·모양)
export default function HeroSection() {
  const { T } = useLang()

  return (
    <section className="relative overflow-hidden">
      {/* 로고의 파란 배지 = 하늘 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 70%)' }}
      />

      {/* 태양 글로우 — 우상단 */}
      <div
        className="absolute -top-16 right-[10%] w-56 h-56 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,211,77,0.9) 0%, rgba(255,211,77,0.35) 40%, transparent 68%)',
        }}
      />

      {/* 로고의 모래 언덕 — 하단 전체 */}
      <svg
        className="absolute bottom-0 left-0 w-full h-24 md:h-28 pointer-events-none"
        viewBox="0 0 1200 110"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 55C220 15 420 5 640 30s380 45 560 30v50H0Z" fill="#f3e3b8" />
        <path d="M0 80c260-28 520-24 760-6s340 16 440 8v28H0Z" fill="#fcfaf5" />
      </svg>

      {/* 로고의 야자수 — 모래 위에 서 있는 실물 (같은 색, 같은 모양) */}
      <svg
        viewBox="10 4 22 24"
        className="absolute right-[4%] md:right-[8%] bottom-6 md:bottom-8 w-32 h-36 md:w-44 md:h-48 pointer-events-none drop-shadow-[0_6px_10px_rgba(30,58,138,0.25)]"
        aria-hidden
      >
        <path d="M15.5 27c.4-5.5 1.2-10 3.2-13.5" stroke="#8a5a2b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <g fill="none" stroke="#39b36b" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18.7 13c-3.2-2.2-6.4-2.4-9-1" />
          <path d="M18.7 13c-1-3.4-3-5.6-5.6-6.6" />
          <path d="M18.7 13c1.4-3.2 3.8-5 6.6-5.4" />
          <path d="M18.7 13c3.4-1.4 6.6-.8 8.8 1" />
          <path d="M18.7 13c2.6.6 4.6 2.4 5.6 5" />
        </g>
      </svg>

      <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-24 md:pt-20 md:pb-32 flex flex-col items-center text-center">
        {/* 태그라인 배지 — 파란 하늘 위 반투명 유리 */}
        <span className="inline-flex items-center gap-2 bg-white/15 border border-white/30 text-white text-[12px] font-bold tracking-[0.22em] rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
          🌊 {T.hero.tagline}
        </span>

        {/* 헤드라인 — 하늘 위 흰 글씨 */}
        <h1 className="text-3xl md:text-[2.6rem] leading-tight font-extrabold text-white whitespace-pre-line mb-8 drop-shadow-[0_2px_10px_rgba(30,58,138,0.35)]">
          {T.hero.promptHeading}
        </h1>

        <HeroPromptInput onBlue />
      </div>
    </section>
  )
}
