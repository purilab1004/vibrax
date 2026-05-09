import Link from 'next/link'

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-gray-800">
      {/* Pixel grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#00ff41 1px, transparent 1px),
            linear-gradient(90deg, #00ff41 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
        <p className="font-pixel text-[#00ff41] text-[10px] tracking-[0.3em] mb-5">
          VIBE CODED · AI POWERED · RETRO SPIRIT
        </p>
        <h1 className="font-pixel text-white text-2xl md:text-[2.5rem] leading-[1.8] mb-6 max-w-2xl">
          고전 게임,{' '}
          <span className="text-[#00ff41]">AI</span>로<br />
          다시 태어나다
        </h1>
        <p className="text-gray-400 text-sm md:text-base mb-10 leading-relaxed max-w-lg">
          ChatGPT, Claude, Cursor — 어떤 AI든 상관없어요.<br />
          직접 만든 게임을 배포하고 Vibrax에서 공유하세요.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/games"
            className="font-pixel text-[11px] bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors"
          >
            ▶ PLAY GAMES
          </Link>
          <Link
            href="/submit"
            className="font-pixel text-[11px] border border-[#00ff41] text-[#00ff41] px-6 py-3 hover:bg-[#00ff41] hover:text-black transition-colors"
          >
            + SUBMIT GAME
          </Link>
        </div>
      </div>
    </section>
  )
}
