'use client'

import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'
import HeroAvatarMarquee from '@/components/HeroAvatarMarquee'
import type { GameWithCreator } from '@/lib/supabase/types'

// 히어로 — linearity.io 컨셉: 풀 뷰포트 첫 화면, 하단 TOP AI AVATAR 마퀴 + 스크롤 유도
export default function HeroSection({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const [line1, line2] = T.hero.promptHeading.split('\n')

  return (
    <section className="relative overflow-hidden -mt-14 pt-14 min-h-[100svh] flex flex-col">
      {/* 배경 영상 — 밝은 오버레이 아래에서 은은하게 재생 */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      {/* 라이트 오버레이 — 흰 배경 유지 + 텍스트 가독성, 아래로 갈수록 본문 배경색으로 녹아든다 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fcfaf5]/80 via-[#fcfaf5]/55 to-[#fcfaf5]" aria-hidden />

      {/* 파랑·초록·노랑 글로우 — 서로 다른 궤적과 속도로 떠다닌다 */}
      <div className="hero-glow hero-glow-blue" aria-hidden />
      <div className="hero-glow hero-glow-green" aria-hidden />
      <div className="hero-glow hero-glow-yellow" aria-hidden />

      {/* 중앙 블록 — 큼직한 헤드라인 + 프롬프트 카드 */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center py-10">
        <h1 className="text-4xl md:text-[3.4rem] leading-[1.12] tracking-tight font-extrabold text-[#241f17] mb-5">
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
      <div className="relative w-full pb-5 space-y-5">
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
