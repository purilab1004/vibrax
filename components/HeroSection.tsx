'use client'

import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'

// 히어로 — 밝은 배경 중앙 정렬: 헤드라인(그라디언트 강조) + 대시 서브라벨 + 프롬프트 카드
export default function HeroSection() {
  const { T } = useLang()
  const [line1, line2] = T.hero.promptHeading.split('\n')

  return (
    <section className="relative overflow-hidden">
      {/* 은은한 오션 그라디언트 틴트 — 밝은 모래 배경 위 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(640px 300px at 32% -10%, rgba(37,99,235,0.10), transparent 70%), radial-gradient(640px 300px at 68% 0%, rgba(6,182,212,0.09), transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-14 md:py-20 flex flex-col items-center text-center">
        {/* 헤드라인 — 마지막 줄은 오션 그라디언트 강조 */}
        <h1 className="text-3xl md:text-[2.6rem] leading-tight font-extrabold text-[#241f17] mb-4">
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
        <div className="flex items-center gap-3 mb-8 w-full max-w-md">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#cfc4ab]" />
          <span className="text-[11px] font-semibold tracking-[0.22em] text-[#857a68] whitespace-nowrap">
            {T.hero.tagline}
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#cfc4ab]" />
        </div>

        <HeroPromptInput />
      </div>
    </section>
  )
}
