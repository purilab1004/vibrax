'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

export default function HeroSection() {
  const { T } = useLang()
  const [line1, line2] = T.hero.heading.split('\n')

  return (
    <section className="relative overflow-hidden border-b border-gray-800 min-h-[480px] md:min-h-[560px]">
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

      <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
        <p className="font-pixel text-[#00ff41] text-[10px] tracking-[0.3em] mb-5">
          {T.hero.tagline}
        </p>
        <h1 className="font-pixel text-white text-2xl md:text-[2.5rem] leading-[1.8] mb-6 max-w-2xl">
          {line1}{line2 && <><br /><span className="text-[#00ff41]">{line2}</span></>}
        </h1>
        <p className="text-gray-300 text-sm md:text-base mb-10 leading-relaxed max-w-lg whitespace-pre-line">
          {T.hero.desc}
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/games"
            className="font-pixel text-[11px] bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors"
          >
            {T.hero.playGames}
          </Link>
          <Link
            href="/submit"
            className="font-pixel text-[11px] border border-[#00ff41] text-[#00ff41] px-6 py-3 hover:bg-[#00ff41] hover:text-black transition-colors"
          >
            {T.hero.submitGame}
          </Link>
        </div>
      </div>
    </section>
  )
}
