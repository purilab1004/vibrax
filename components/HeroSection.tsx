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

      {/* 은은한 하이라이트 — 중앙 상단에서 퍼지는 빛 */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-72 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 45%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-14 md:py-20 flex flex-col items-center text-center">
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
