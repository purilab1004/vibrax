'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n/context'
import HeroPromptInput from '@/components/HeroPromptInput'
import HeroAvatarMarquee from '@/components/HeroAvatarMarquee'
import type { GameWithCreator } from '@/lib/supabase/types'

const TYPE_MS = 85        // 글자당 타이핑 속도
const CYCLE_MS = 10000    // 10초마다 폰트 바꿔서 재타이핑

// tropica가 먼저, vecto가 다음
const VIDEOS = ['/hero-bg-2.mp4', '/hero-bg.mp4']
const ROTATE_MS = 14000

// 히어로 — linearity.io 컨셉: 풀 뷰포트 첫 화면, 배경 영상 로테이션, 하단 TOP AI AVATAR 마퀴
export default function HeroSection({ games }: { games: GameWithCreator[] }) {
  const { T } = useLang()
  const [line1, line2] = T.hero.promptHeading.split('\n')
  const [vid, setVid] = useState(0)

  // 두 영상을 크로스페이드로 로테이션
  useEffect(() => {
    const t = setInterval(() => setVid(v => (v + 1) % VIDEOS.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [])

  // 타이핑 헤드라인 — 10초 주기로 부드럽게 다시 타이핑
  const full = `${line1}\n${line2 ?? ''}`
  const [typedN, setTypedN] = useState(full.length)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedN(full.length)
      return
    }
    let typeTimer: ReturnType<typeof setInterval> | null = null
    const startTyping = () => {
      if (typeTimer) clearInterval(typeTimer)
      setTypedN(0)
      typeTimer = setInterval(() => {
        setTypedN(prev => {
          if (prev >= full.length) {
            if (typeTimer) clearInterval(typeTimer)
            return prev
          }
          return prev + 1
        })
      }, TYPE_MS)
    }
    startTyping()
    const cycle = setInterval(startTyping, CYCLE_MS)
    return () => {
      clearInterval(cycle)
      if (typeTimer) clearInterval(typeTimer)
    }
  }, [full])

  const typed = full.slice(0, typedN)
  const [typed1, typed2 = ''] = typed.split('\n')
  const typingDone = typedN >= full.length

  return (
    <section className="relative overflow-hidden -mt-14 pt-14 min-h-[100svh] flex flex-col bg-white">
      {/* 배경 영상 — 상단 10% 아래에서 시작, 활성 영상만 보이고 1.5초 크로스페이드 */}
      {VIDEOS.map((src, i) => (
        <video
          key={src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms] ${
            vid === i ? 'opacity-55' : 'opacity-0'
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload={i === 0 ? 'auto' : 'metadata'}
          aria-hidden
        >
          <source src={src} type="video/mp4" />
        </video>
      ))}
      {/* 보호 오버레이 — 위·중간(프롬프트까지) 흰색, 좌우 가장자리는 영상이 살짝 비친다 */}
      <div className="hero-shield absolute inset-0" aria-hidden />
      {/* 하단 페이드 — 본문 배경색으로 자연스럽게 연결 */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#fcfaf5]" aria-hidden />

      {/* 파랑·초록·노랑 글로우 — 서로 다른 궤적과 속도로 떠다닌다 */}
      <div className="hero-glow hero-glow-blue" aria-hidden />
      <div className="hero-glow hero-glow-green" aria-hidden />
      <div className="hero-glow hero-glow-yellow" aria-hidden />

      {/* 중앙 블록 — 헤드라인 + 프롬프트 카드 */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center py-10">
        <h1 className="relative text-3xl md:text-5xl leading-[1.15] tracking-tight font-extrabold text-[#241f17] mb-5">
          {/* 투명 원본 — 높이/폭을 미리 확보해 레이아웃 흔들림 방지 */}
          <span className="invisible" aria-hidden>
            {line1}
            {line2 && (<><br />{line2}</>)}
          </span>
          {/* 타이핑 오버레이 — 글자가 번지듯 부드럽게 떠오른다 */}
          <span className="absolute inset-0" aria-label={`${line1} ${line2 ?? ''}`}>
            {typed1.split('').map((ch, i) => (
              <span key={i} className="char-in inline-block whitespace-pre">{ch}</span>
            ))}
            {typedN > line1.length && <br />}
            <span>
              {/* 그라디언트는 글자별로 자기 구간을 직접 칠한다 — 부모 bg-clip은 블러/이동 애니메이션과 충돌해 투명해짐 */}
              {typed2.split('').map((ch, i) => {
                const len = line2?.length ?? 1
                return (
                  <span
                    key={i}
                    className="char-in inline-block whitespace-pre bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #2563eb, #06b6d4)',
                      backgroundSize: `${len * 100}% 100%`,
                      backgroundPosition: `${len > 1 ? (i / (len - 1)) * 100 : 0}% 0`,
                    }}
                  >
                    {ch}
                  </span>
                )
              })}
            </span>
            {!typingDone && <span className="text-[#2563eb] animate-pulse">|</span>}
          </span>
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
      <div className="relative w-full pb-5 space-y-4">
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
