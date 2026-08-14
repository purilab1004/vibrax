'use client'

import { useState } from 'react'
import Link from 'next/link'
import { auroraOf } from '@/components/GameCard'
import Reveal from '@/components/Reveal'
import { useLang } from '@/lib/i18n/context'

// 눌리는 점토이 — 누른 '방향'에 따라 다르게 찌그러지는 대형 클레이 캐릭터
type PressZone = 'top' | 'bottom' | 'left' | 'right' | 'center'

// 방향별 찌그러짐 — 누른 쪽이 눌리도록 반대편을 기준점으로 스케일
const PRESS_DEFORM: Record<PressZone, { origin: string; transform: string }> = {
  top: { origin: '100px 166px', transform: 'scale(1.08, 0.82)' },
  bottom: { origin: '100px 30px', transform: 'scale(1.08, 0.88)' },
  left: { origin: '164px 96px', transform: 'scale(0.84, 1.07)' },
  right: { origin: '32px 96px', transform: 'scale(0.84, 1.07)' },
  center: { origin: '97px 96px', transform: 'scale(0.9, 0.9)' },
}

function ClayHero() {
  const [dent, setDent] = useState<{ x: number; y: number; zone: PressZone } | null>(null)

  const press = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 200
    const y = ((e.clientY - r.top) / r.height) * 200
    const dx = x - 97
    const dy = y - 96
    let zone: PressZone = 'center'
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      zone = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'top' : 'bottom') : (dx < 0 ? 'left' : 'right')
    }
    setDent({ x, y, zone })
  }
  const release = () => setDent(null)

  const deform = dent ? PRESS_DEFORM[dent.zone] : null

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
        {/* 몸통 — 누른 방향으로 찌그러진다 */}
        <g
          className="transition-transform duration-150 ease-out"
          style={{
            transformOrigin: deform ? deform.origin : '100px 166px',
            transform: deform ? deform.transform : 'scale(1, 1)',
          }}
        >
          {/* 뒤판 */}
          <rect x="38" y="36" width="130" height="130" rx="34" fill="#b93d16" transform="rotate(-3 108 106)" />
          {/* 앞판 */}
          <rect x="30" y="28" width="130" height="130" rx="34" fill="#F05A28" transform="rotate(-3 95 93)" />
          {/* 상단 밝은 면 */}
          <rect x="30" y="28" width="130" height="58" rx="34" fill="#ff8a5c" opacity="0.6" transform="rotate(-3 95 93)" />
          {/* 눌린 자국 — 누른 지점에 움푹 */}
          {dent && (
            <g className="pointer-events-none">
              <ellipse cx={dent.x} cy={dent.y} rx="17" ry="14" fill="#8f2f0e" opacity="0.45" />
              <ellipse cx={dent.x - 3} cy={dent.y - 3} rx="9" ry="7" fill="#701f05" opacity="0.35" />
            </g>
          )}
          {/* 눈 — 중앙(얼굴)을 누르면 질끈, 가장자리를 누르면 놀란 눈 */}
          {dent?.zone === 'center' ? (
            <g stroke="#161616" strokeWidth="4" strokeLinecap="round" fill="none">
              <path d="M74 92q6 5 12 0" />
              <path d="M114 92q6 5 12 0" />
            </g>
          ) : dent ? (
            <>
              <circle cx="80" cy="90" r="7" fill="#161616" />
              <circle cx="120" cy="90" r="7" fill="#161616" />
              <circle cx="82" cy="87.5" r="2" fill="#ffffff" />
              <circle cx="122" cy="87.5" r="2" fill="#ffffff" />
            </>
          ) : (
            <>
              <circle cx="80" cy="90" r="5.5" fill="#161616" />
              <circle cx="120" cy="90" r="5.5" fill="#161616" />
            </>
          )}
          {/* 볼터치 */}
          <circle cx="66" cy="108" r="8" fill="#ffffff" opacity="0.32" />
          <circle cx="134" cy="108" r="8" fill="#ffffff" opacity="0.32" />
          {/* 입 — 중앙: 오므림, 가장자리: 앗! 벌어짐, 평소: 미소 */}
          {dent?.zone === 'center' ? (
            <ellipse cx="100" cy="112" rx="5" ry="6.5" fill="#161616" />
          ) : dent ? (
            <ellipse cx="100" cy="113" rx="7.5" ry="9" fill="#161616" />
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
    {
      ...a.p1, accent: ko ? '만들다' : 'Create', color: '#F05A28', seed: 'about-create-01', views: 300,
      brief: ko ? '코드 없이 프롬프트만으로 나만의 게임을 빚어냅니다' : 'Shape your own game with prompts alone — no code',
    },
    {
      ...a.p2, accent: ko ? '방송하다' : 'Stream', color: '#5AB0F2', seed: 'about-stream-2', views: 900,
      brief: ko ? 'AI 스트리머 AJ가 내 게임을 실시간으로 중계합니다' : 'AI streamer AJ broadcasts your game live',
    },
    {
      ...a.p3, accent: ko ? '벌다' : 'Earn', color: '#c9940c', seed: 'about-earn-x7', views: 4500,
      brief: ko ? '내 AGENT가 대신 뛰며 수익의 기회를 만듭니다' : 'Your AGENT plays for you and opens up income',
    },
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

      {/* ── 3 PHASE 한눈에 — 상세로 들어가기 전 요약 스트립 ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <Reveal className="text-center mb-12">
          <p className="italic font-bold tracking-tight text-xl md:text-2xl text-[#F05A28] mb-3">
            {ko ? 'How it works' : 'How it works'}
          </p>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#241f17] leading-[1.25]">
            {ko ? (
              <>추억을 <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">프롬프트</span>로 되살리다.<br />그리고 즐겨라.</>
            ) : (
              <>Bring memories back with a <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">prompt</span>.<br />Then enjoy the ride.</>
            )}
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="grid md:grid-cols-3 border-t border-l border-[#ddd3bf]">
            {phases.map((p, i) => (
              <a
                key={i}
                href={`#phase-${i + 1}`}
                className="group border-b border-r border-[#ddd3bf] p-7 bg-white/50 hover:bg-white transition-colors"
              >
                <div className="flex items-baseline justify-between mb-4">
                  <span className="font-pixel text-[24px] font-extrabold" style={{ color: p.color }}>
                    0{i + 1}
                  </span>
                  <span className="italic font-bold tracking-tight text-lg text-[#857a68] group-hover:text-[#F05A28] transition-colors">
                    {p.accent}
                  </span>
                </div>
                <p className="font-pixel text-[11px] text-[#9d9280] tracking-[0.25em] mb-2.5">{p.label}</p>
                <p className="text-[15px] font-semibold text-[#241f17] leading-relaxed">{p.brief}</p>
                <span className="inline-block mt-4 text-[13px] text-[#857a68] group-hover:text-[#2563eb] group-hover:translate-x-1 transition-all">
                  {ko ? '자세히 보기' : 'Read more'} →
                </span>
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── 세 가지 이유 — 교차 레이아웃 ── */}
      {phases.map((p, i) => (
        <section key={i} id={`phase-${i + 1}`} className={`scroll-mt-20 ${i % 2 === 1 ? 'bg-white/60' : ''}`}>
          <div className={`max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center`}>
            {/* 텍스트 */}
            <Reveal className={i % 2 === 1 ? 'md:order-2' : ''}>
              <p className="italic font-bold tracking-tight text-2xl md:text-3xl text-[#F05A28] -mb-1">{p.accent}</p>
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
                  <div className="absolute inset-x-1 top-[6%] bottom-[12%]">
                    <AboutScene variant={i} />
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


// 섹션별 점토 장면 — 0: 안경+노트북 프롬프팅 / 1: 헤드폰+뻐끔 입 / 2: 동전 쏟아짐
function AboutScene({ variant }: { variant: number }) {
  return (
    <svg viewBox="0 0 200 192" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {variant === 0 && (
        <g className="critter-bob">
          <ellipse cx="100" cy="168" rx="52" ry="8" fill="#000" opacity="0.14" />
          {/* 몸통 — 오렌지 점토 */}
          <rect x="66" y="42" width="80" height="80" rx="20" fill="#b93d16" transform="rotate(-3 111 87)" />
          <rect x="60" y="36" width="80" height="80" rx="20" fill="#F05A28" transform="rotate(-3 100 76)" />
          <rect x="60" y="36" width="80" height="36" rx="20" fill="#ff8a5c" opacity="0.6" transform="rotate(-3 100 76)" />
          {/* 안경 — 동그란 렌즈 + 브리지 */}
          <g stroke="#161616" strokeWidth="3" fill="#ffffff" fillOpacity="0.85">
            <circle cx="84" cy="72" r="11" />
            <circle cx="116" cy="72" r="11" />
          </g>
          <path d="M95 72h10" stroke="#161616" strokeWidth="3" strokeLinecap="round" />
          <circle cx="85" cy="73" r="2.6" fill="#161616" />
          <circle cx="115" cy="73" r="2.6" fill="#161616" />
          {/* 집중한 입 */}
          <path d="M95 92q5 3.5 10 0" stroke="#161616" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* 노트북 — 화면 + 타이핑 코드 + 깜빡이 커서 */}
          <g transform="rotate(-2 100 140)">
            <rect x="58" y="112" width="84" height="40" rx="4" fill="#1c1c26" />
            <rect x="63" y="118" width="42" height="3.5" rx="1.5" fill="#7ef0ff" opacity="0.85" />
            <rect x="63" y="126" width="58" height="3.5" rx="1.5" fill="#8fa6ff" opacity="0.7" />
            <rect x="63" y="134" width="30" height="3.5" rx="1.5" fill="#7ef0ff" opacity="0.6" />
            <rect x="96" y="133" width="4" height="6" fill="#7ef0ff" className="animate-pulse" />
            <rect x="50" y="152" width="100" height="9" rx="4" fill="#3a3a46" />
          </g>
          {/* 타이핑 손 */}
          <circle cx="74" cy="152" r="6.5" fill="#F05A28" />
          <circle cx="126" cy="152" r="6.5" fill="#F05A28" />
        </g>
      )}
      {variant === 1 && (
        <g className="critter-bob">
          <ellipse cx="100" cy="168" rx="52" ry="8" fill="#000" opacity="0.14" />
          {/* 몸통 — 블루 점토 */}
          <rect x="66" y="52" width="80" height="80" rx="20" fill="#2f7cb8" transform="rotate(-3 111 97)" />
          <rect x="60" y="46" width="80" height="80" rx="20" fill="#5AB0F2" transform="rotate(-3 100 86)" />
          <rect x="60" y="46" width="80" height="36" rx="20" fill="#8fd0ff" opacity="0.6" transform="rotate(-3 100 86)" />
          {/* 헤드폰 — 핑크 밴드 + 이어컵 */}
          <path d="M58 84c0-30 18-46 42-46s42 16 42 46" stroke="#ec4899" strokeWidth="9" strokeLinecap="round" fill="none" />
          <rect x="48" y="76" width="16" height="30" rx="7" fill="#ec4899" />
          <rect x="136" y="76" width="16" height="30" rx="7" fill="#ec4899" />
          {/* 눈 — 신나서 감은 눈 */}
          <g stroke="#161616" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M78 82q6 -5 12 0" />
            <path d="M110 82q6 -5 12 0" />
          </g>
          {/* 입 — 커졌다 작아졌다 뻐끔 */}
          <circle cx="100" cy="102" r="8" fill="#161616" className="mouth-pulse" style={{ transformOrigin: '100px 102px' }} />
          {/* 음표 */}
          <g fill="#ffffff" opacity="0.9">
            <text x="150" y="70" fontSize="17" style={{ animation: 'floatUpFade 2.6s ease-out infinite' }}>♪</text>
            <text x="38" y="96" fontSize="14" style={{ animation: 'floatUpFade 3.1s ease-out infinite', animationDelay: '1.2s' }}>♫</text>
          </g>
        </g>
      )}
      {variant === 2 && (
        <g>
          <ellipse cx="100" cy="168" rx="56" ry="8" fill="#000" opacity="0.14" />
          {/* 몸통 — 골드 점토 */}
          <g className="critter-bob">
            <rect x="66" y="40" width="80" height="80" rx="20" fill="#b3830a" transform="rotate(-3 111 85)" />
            <rect x="60" y="34" width="80" height="80" rx="20" fill="#F2B436" transform="rotate(-3 100 74)" />
            <rect x="60" y="34" width="80" height="36" rx="20" fill="#ffd97a" opacity="0.65" transform="rotate(-3 100 74)" />
            {/* 눈 — 활짝 웃는 눈 */}
            <g stroke="#161616" strokeWidth="3.5" strokeLinecap="round" fill="none">
              <path d="M78 68q7 -6 14 0" />
              <path d="M108 68q7 -6 14 0" />
            </g>
            {/* 볼터치 */}
            <circle cx="76" cy="82" r="6" fill="#ffffff" opacity="0.35" />
            <circle cx="124" cy="82" r="6" fill="#ffffff" opacity="0.35" />
            {/* 활짝 웃는 입 */}
            <path d="M86 84q14 13 28 0" stroke="#161616" strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
          {/* 하늘에서 쏟아지는 동전들 — 점토이 주변으로 떨어져 쌓인다 */}
          {([['-8px', '118px', '0s', 54], ['5px', '128px', '0.4s', 88], ['-6px', '124px', '0.8s', 118], ['8px', '112px', '1.2s', 148], ['4px', '132px', '1.5s', 70], ['-5px', '130px', '0.2s', 134]] as const).map(([fx, fy, d, sx], i) => (
            <g key={i} className="coin-flow" style={{ ['--fx' as string]: fx, ['--fy' as string]: fy, animationDelay: d }}>
              <circle cx={sx} cy="26" r="8" fill="#F2B436" stroke="#b3830a" strokeWidth="2.5" />
              <circle cx={sx} cy="26" r="4" fill="none" stroke="#b3830a" strokeWidth="1.6" />
            </g>
          ))}
          {/* 바닥에 쌓인 동전 */}
          <g fill="#F2B436" stroke="#b3830a" strokeWidth="2">
            <ellipse cx="70" cy="156" rx="10" ry="4.5" />
            <ellipse cx="92" cy="162" rx="10" ry="4.5" />
            <ellipse cx="116" cy="158" rx="10" ry="4.5" />
            <ellipse cx="103" cy="152" rx="10" ry="4.5" />
            <ellipse cx="136" cy="162" rx="10" ry="4.5" />
          </g>
        </g>
      )}
    </svg>
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
