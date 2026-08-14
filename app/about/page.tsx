'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RoomScene, auroraOf } from '@/components/GameCard'
import Reveal from '@/components/Reveal'
import { useLang } from '@/lib/i18n/context'

// 눌리는 점토이 — 누른 자리가 움푹 들어가는 대형 클레이 캐릭터
function ClayHero() {
  const [dent, setDent] = useState<{ x: number; y: number } | null>(null)

  const press = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setDent({
      x: ((e.clientX - r.left) / r.width) * 200,
      y: ((e.clientY - r.top) / r.height) * 200,
    })
  }
  const release = () => setDent(null)

  return (
    <div className="relative select-none">
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[560px] lg:max-w-[660px] mx-auto cursor-pointer touch-none"
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        aria-label="점토이 — 눌러보세요"
      >
        {/* 바닥 그림자 */}
        <ellipse cx="100" cy="176" rx="62" ry="10" fill="#000" opacity="0.12" />
        {/* 몸통 — 누르면 눌린 자리 쪽으로 살짝 찌그러진다 */}
        <g
          className="transition-transform duration-150 ease-out"
          style={{
            transformOrigin: '100px 168px',
            transform: dent ? 'scale(1.045, 0.94)' : 'scale(1, 1)',
          }}
        >
          {/* 뒤판 */}
          <rect x="38" y="36" width="130" height="130" rx="34" fill="#b93d16" transform="rotate(-3 108 106)" />
          {/* 앞판 */}
          <rect x="30" y="28" width="130" height="130" rx="34" fill="#F05A28" transform="rotate(-3 95 93)" />
          {/* 상단 밝은 면 */}
          <rect x="30" y="28" width="130" height="58" rx="34" fill="#ff8a5c" opacity="0.6" transform="rotate(-3 95 93)" />
          {/* 하이라이트 */}
          <ellipse cx="62" cy="52" rx="26" ry="14" fill="#ffffff" opacity="0.4" transform="rotate(-16 62 52)" />
          {/* 눌린 자국 — 누른 지점에 움푹 */}
          {dent && (
            <g className="pointer-events-none">
              <ellipse cx={dent.x} cy={dent.y} rx="17" ry="14" fill="#8f2f0e" opacity="0.45" />
              <ellipse cx={dent.x - 3} cy={dent.y - 3} rx="9" ry="7" fill="#701f05" opacity="0.35" />
            </g>
          )}
          {/* 눈 — 누르면 질끈 감는다 */}
          {dent ? (
            <g stroke="#161616" strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M74 92q6 5 12 0" />
              <path d="M114 92q6 5 12 0" />
            </g>
          ) : (
            <>
              <circle cx="80" cy="90" r="5.5" fill="#161616" />
              <circle cx="120" cy="90" r="5.5" fill="#161616" />
            </>
          )}
          {/* 볼터치 */}
          <circle cx="66" cy="108" r="8" fill="#ffffff" opacity="0.32" />
          <circle cx="134" cy="108" r="8" fill="#ffffff" opacity="0.32" />
          {/* 입 — 누르면 오므린다 */}
          {dent ? (
            <ellipse cx="100" cy="112" rx="5" ry="6.5" fill="#161616" />
          ) : (
            <path d="M92 108q8 7 16 0" stroke="#161616" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          )}
        </g>
      </svg>
      <p className="text-center text-[13px] text-[#9d9280] mt-3 animate-pulse">
        👆 점토이를 꾹 눌러보세요
      </p>
    </div>
  )
}

export default function AboutPage() {
  const { T, lang } = useLang()
  const a = T.about
  const ko = lang === 'ko'

  const phases = [
    { ...a.p1, accent: ko ? '만들다' : 'Create', color: '#F05A28', seed: 'about-create-01', views: 300 },
    { ...a.p2, accent: ko ? '방송하다' : 'Stream', color: '#5AB0F2', seed: 'about-stream-2', views: 900 },
    { ...a.p3, accent: ko ? '벌다' : 'Earn', color: '#c9940c', seed: 'about-earn-x7', views: 4500 },
  ]

  return (
    <div className="overflow-hidden">
      {/* ── Hero — 좌: 환영 카피 / 우: 눌리는 점토이 ── */}
      <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-20 pb-20 grid md:grid-cols-[1fr_1.25fr] gap-12 items-center">
        <Reveal>
          <p className="font-pixel text-[#2563eb] text-[11px] tracking-[0.4em] mb-6">{a.badge}</p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#241f17] leading-[1.2] mb-7">
            {ko ? (
              <>비브렉스에<br />오신 걸 <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">환영합니다</span></>
            ) : (
              <>Welcome<br />to <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">Vibrexcup</span></>
            )}
          </h1>
          <p className="text-[#4a4337] text-base md:text-lg leading-[1.9] max-w-md">
            {ko
              ? '자연스러운 질감과 형태. 손의 압력으로 점토를 다지며 빚어내듯, 여러분은 프롬프트로 작품을 빚어냅니다. 한 문장씩 누르고, 굴리고, 다듬다 보면 — 어느새 나만의 게임이 완성돼요.'
              : 'Natural texture and form. Just as clay takes shape under the pressure of your hands, you shape your creation with prompts. Press, roll, refine — sentence by sentence, your game comes to life.'}
          </p>
        </Reveal>
        <Reveal delay={150}>
          <ClayHero />
        </Reveal>
      </section>

      {/* ── 세 가지 이유 — 교차 레이아웃 ── */}
      {phases.map((p, i) => (
        <section key={i} className={i % 2 === 1 ? 'bg-white/60' : ''}>
          <div className={`max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center`}>
            {/* 텍스트 */}
            <Reveal className={i % 2 === 1 ? 'md:order-2' : ''}>
              <p className="font-serif italic text-2xl md:text-3xl text-[#F05A28] -mb-1">{p.accent}</p>
              <p className="font-pixel text-[#241f17] text-2xl md:text-4xl tracking-tight font-extrabold mb-2">
                {p.phase}
              </p>
              <p className="font-pixel text-[11px] text-[#857a68] tracking-[0.3em] mb-6">{p.label}</p>
              <blockquote className="text-xl md:text-2xl font-bold text-[#241f17] leading-relaxed mb-5">
                {p.quote}
              </blockquote>
              <p className="text-[#4a4337] text-sm md:text-base leading-[2] max-w-lg">{p.body}</p>
            </Reveal>
            {/* 비주얼 카드 — 오로라 + 점토 캐릭터, 살짝 기울어진 포스터 */}
            <Reveal delay={120} className={i % 2 === 1 ? 'md:order-1' : ''}>
              <div className={`relative mx-auto w-full max-w-sm ${i % 2 === 1 ? 'md:-rotate-2' : 'md:rotate-2'}`}>
                <div className="grain relative aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(36,31,23,0.25)]" style={auroraOf(p.seed, i === 2)}>
                  <div className="absolute inset-x-1 top-[8%] bottom-[16%]">
                    <RoomScene id={p.seed} views={p.views} />
                  </div>
                  <span className="absolute left-4 bottom-4 font-pixel text-[11px] tracking-[0.2em] text-white drop-shadow">
                    {p.label}
                  </span>
                  <span className="absolute right-4 bottom-4 text-white/90" aria-hidden>→</span>
                </div>
                {/* 뒤에 겹친 카드 — 스택 느낌 */}
                <div className="absolute inset-x-4 -bottom-2 h-6 rounded-b-2xl bg-[#241f17]/10 -z-10" />
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      {/* ── 마지막 CTA — 오로라 피날레 ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24 pt-8">
        <Reveal>
          <div className="grain relative rounded-3xl overflow-hidden text-center px-6 py-16 md:py-24 shadow-[0_30px_90px_rgba(37,99,235,0.25)]" style={auroraOf('about-finale-9')}>
            {/* 떠다니는 미니 점토이들 */}
            <div className="absolute left-[6%] top-[14%] w-24 opacity-90 critter-bob hidden md:block"><MiniClay color="#5AB0F2" /></div>
            <div className="absolute right-[8%] top-[20%] w-16 opacity-90 critter-bob hidden md:block" style={{ animationDelay: '1.2s' }}><MiniClay color="#F2B436" /></div>
            <div className="absolute left-[14%] bottom-[12%] w-14 opacity-90 critter-bob hidden md:block" style={{ animationDelay: '2s' }}><MiniClay color="#4CB97E" /></div>
            <div className="absolute right-[12%] bottom-[16%] w-20 opacity-90 critter-bob hidden md:block" style={{ animationDelay: '0.6s' }}><MiniClay color="#F2A0C0" /></div>

            <p className="font-pixel text-white/90 text-[11px] tracking-[0.4em] mb-6 drop-shadow">{a.s5.label}</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)] mb-4">
              {a.s5.heading}
            </h2>
            <p className="text-white/90 text-base md:text-lg font-semibold mb-10 drop-shadow">{a.s5.cta}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/studio"
                className="rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[14px] tracking-[0.2em] px-12 py-5 shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_6px_0_#8f1508,0_14px_28px_rgba(0,0,0,0.35)] active:translate-y-1.5 active:shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_2px_0_#8f1508] transition-all"
              >
                ▶ START
              </Link>
              <Link
                href="/games"
                className="rounded-full bg-white/90 backdrop-blur-sm text-[#241f17] text-[14px] font-bold px-8 py-4 hover:bg-white transition-colors shadow-[0_6px_20px_rgba(0,0,0,0.2)]"
              >
                {a.s5.btn1}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

// 미니 점토이 — CTA 장식용
function MiniClay({ color }: { color: string }) {
  const dark = `#${(Math.max(0, parseInt(color.slice(1), 16) - 0x2a2a2a)).toString(16).padStart(6, '0')}`
  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" aria-hidden>
      <rect x="22" y="22" width="60" height="60" rx="16" fill={dark} transform="rotate(-3 54 54)" opacity="0.85" />
      <rect x="18" y="18" width="60" height="60" rx="16" fill={color} transform="rotate(-3 48 48)" />
      <circle cx="40" cy="45" r="2.8" fill="#161616" />
      <circle cx="58" cy="45" r="2.8" fill="#161616" />
      <path d="M44 54q5 4 10 0" stroke="#161616" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
