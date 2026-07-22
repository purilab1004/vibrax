'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'

export default function HeroSection() {
  const { T } = useLang()
  const [line1, line2] = T.hero.promptHeading.split('\n')

  return (
    <section className="relative overflow-hidden border-b border-gray-800">
      {/* Background image — right side visible, fades left */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/slider-image.png')" }}
      />

      {/* Strong dark overlay on left (text area), fades to subtle on right */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgba(10,10,10,0.93) 0%, rgba(10,10,10,0.88) 30%, rgba(10,10,10,0.5) 55%, rgba(10,10,10,0.15) 75%, rgba(10,10,10,0.05) 100%)',
        }}
      />

      {/* Bottom fade to page background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 60%, #0a0a0a 100%)',
        }}
      />

      {/* Pixel grid overlay (subtle) */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#00ff41 1px, transparent 1px),
            linear-gradient(90deg, #00ff41 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* 컴팩트 히어로 — 프롬프트 입력이 핵심, 아래 kick식 라이브 그리드가 메인 */}
      <div className="relative max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col items-center text-center">
        <p className="font-pixel text-[#00ff41] text-[11px] tracking-[0.3em] mb-4">
          {T.hero.tagline}
        </p>
        <h1 className="font-pixel text-white text-lg md:text-2xl leading-[1.8] mb-7">
          {line1}{line2 && <><br /><span className="text-[#00ff41]">{line2}</span></>}
        </h1>
        <HeroPromptInput />
      </div>
    </section>
  )
}
