'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'

export default function HeroSection() {
  const { T } = useLang()

  return (
    <section className="relative overflow-hidden border-b border-[#ebe4d6]">
      {/* Background image — right side visible, fades left */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/slider-image.png')" }}
      />

      {/* 배경 이미지를 강하게 눌러 은은한 질감만 남김 — 프롬프트 입력창이 주인공 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgba(247,242,233,0.97) 0%, rgba(247,242,233,0.92) 40%, rgba(247,242,233,0.88) 70%, rgba(247,242,233,0.92) 100%)',
        }}
      />

      {/* Bottom fade to page background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 60%, #fcfaf5 100%)',
        }}
      />

      {/* Pixel grid overlay (subtle) */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#2563eb 1px, transparent 1px),
            linear-gradient(90deg, #2563eb 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* 컴팩트 히어로 — 프롬프트 입력이 핵심, 아래 kick식 라이브 그리드가 메인 */}
      <div className="relative max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col items-center text-center">
        <p className="font-pixel text-[#2563eb] text-[11px] tracking-[0.3em] mb-6">
          {T.hero.tagline}
        </p>
        <HeroPromptInput />
      </div>
    </section>
  )
}
