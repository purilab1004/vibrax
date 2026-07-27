'use client'

import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'

// 비치 히어로 — 하늘→모래 그라디언트 위에 태양·파도·야자수(로고 모티프), 프롬프트 입력이 주인공
export default function HeroSection() {
  const { T } = useLang()

  return (
    <section className="relative overflow-hidden border-b border-[#ebe4d6]">
      {/* 하늘 → 백사장 그라디언트 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #dbeafe 0%, #eff6ff 45%, #fcfaf5 100%)',
        }}
      />

      {/* 태양 — 우상단 은은한 글로우 */}
      <div
        className="absolute -top-10 right-[12%] w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,211,77,0.55) 0%, rgba(255,211,77,0.18) 45%, transparent 70%)',
        }}
      />

      {/* 야자수 — 좌하단 큰 실루엣 (로고 모티프) */}
      <svg
        viewBox="0 0 32 32"
        className="absolute -left-6 bottom-0 w-48 h-48 opacity-[0.10] pointer-events-none"
        aria-hidden
      >
        <path d="M15.5 27c.4-5.5 1.2-10 3.2-13.5" stroke="#1e3a8a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <g fill="none" stroke="#1e3a8a" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18.7 13c-3.2-2.2-6.4-2.4-9-1" />
          <path d="M18.7 13c-1-3.4-3-5.6-5.6-6.6" />
          <path d="M18.7 13c1.4-3.2 3.8-5 6.6-5.4" />
          <path d="M18.7 13c3.4-1.4 6.6-.8 8.8 1" />
          <path d="M18.7 13c2.6.6 4.6 2.4 5.6 5" />
        </g>
      </svg>

      {/* 파도 라인 — 하단 부드러운 두 겹 */}
      <svg className="absolute bottom-0 left-0 w-full h-14 pointer-events-none" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden>
        <path d="M0 35c100-18 200-18 300 0s200 18 300 0 200-18 300 0 200 18 300 0v25H0Z" fill="#bfdbfe" opacity="0.5" />
        <path d="M0 45c100-14 200-14 300 0s200 14 300 0 200-14 300 0 200 14 300 0v15H0Z" fill="#fcfaf5" />
      </svg>

      <div className="relative max-w-7xl mx-auto px-6 py-14 md:py-20 flex flex-col items-center text-center">
        {/* 태그라인 배지 */}
        <span className="inline-flex items-center gap-2 bg-white/80 border border-[#bfdbfe] text-[#2563eb] text-[12px] font-bold tracking-[0.22em] rounded-full px-4 py-1.5 mb-6 shadow-sm backdrop-blur-sm">
          🌊 {T.hero.tagline}
        </span>

        {/* 헤드라인 */}
        <h1 className="text-3xl md:text-[2.6rem] leading-tight font-extrabold text-[#241f17] whitespace-pre-line mb-8">
          {T.hero.promptHeading}
        </h1>

        <HeroPromptInput />
      </div>
    </section>
  )
}
