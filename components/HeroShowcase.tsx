'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

// 시나리오별 게임 카드 아트 — 어두운 화면(게임 스크린 느낌) 위 큰 이모지
const SCENE_ART = [
  { emoji: '🧱', bg: 'bg-gradient-to-br from-[#1e293b] to-[#2563eb]' },
  { emoji: '🦖', bg: 'bg-gradient-to-br from-[#065f46] to-[#06b6d4]' },
  { emoji: '🚀', bg: 'bg-gradient-to-br from-[#0f172a] to-[#7c3aed]' },
] as const

const CYCLE_MS = 5200

// 스튜디오 대화 목업 — 프롬프트 → AI가 게임 카드로 응답하는 장면이 자동 순환
export default function HeroShowcase() {
  const { T } = useLang()
  const scenes = T.hero.showcase
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % scenes.length), CYCLE_MS)
    return () => clearInterval(t)
  }, [scenes.length])

  const scene = scenes[idx]
  const art = SCENE_ART[idx % SCENE_ART.length]

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 섹션 헤딩 — 스크롤로 진입하는 데모 섹션 */}
      <h2 className="text-center text-2xl md:text-3xl font-extrabold text-[#241f17] mb-8">
        {T.hero.showcaseHeading}
      </h2>
      <Link
        href="/studio"
        aria-label={T.hero.showcaseBadge}
        className="block rounded-2xl border border-[#ebe4d6] bg-white shadow-[0_24px_80px_-24px_rgba(37,99,235,0.28)] hover:shadow-[0_28px_90px_-24px_rgba(37,99,235,0.4)] transition-shadow overflow-hidden text-left"
      >
        {/* 슬림 헤더 — 스튜디오 라벨 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#f3eee2]">
          <span className="w-5 h-5 rounded-md bg-gradient-to-r from-[#2563eb] to-[#06b6d4] flex items-center justify-center text-white text-[10px]" aria-hidden>✦</span>
          <span className="text-[10px] font-bold tracking-[0.18em] text-[#857a68]">{T.hero.showcaseBadge}</span>
          <span className="ml-auto flex items-center gap-1.5" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-semibold tracking-widest text-[#b3a78f]">LIVE</span>
          </span>
        </div>

        {/* 대화 본문 — 시나리오 전환 시 순차 등장 */}
        <div key={idx} className="px-5 py-5 md:px-6 md:py-6 space-y-4 min-h-[280px] sm:min-h-[300px]">
          {/* 유저 프롬프트 버블 */}
          <div className="flex justify-end hero-chat-in">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#2563eb] text-white text-[13px] md:text-sm px-4 py-2.5 leading-relaxed">
              {scene.user}
            </p>
          </div>

          {/* AI 응답 — 텍스트 + 게임 카드 */}
          <div className="flex items-start gap-2.5">
            <span className="hero-chat-in shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] flex items-center justify-center text-white text-[11px]" style={{ animationDelay: '0.5s' }} aria-hidden>✦</span>
            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="hero-chat-in inline-block max-w-[95%] rounded-2xl rounded-bl-md bg-[#fcfaf5] border border-[#ebe4d6] text-[13px] md:text-sm text-[#3a332a] px-4 py-2.5 leading-relaxed" style={{ animationDelay: '0.5s' }}>
                {scene.ai}
              </p>
              {/* 임베디드 게임 카드 */}
              <div className="hero-chat-in max-w-[320px] rounded-xl border border-[#ebe4d6] overflow-hidden shadow-sm" style={{ animationDelay: '1s' }}>
                <div className={`relative aspect-[16/7] ${art.bg} flex items-center justify-center`}>
                  <span className="text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]" aria-hidden>{art.emoji}</span>
                  <span className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_3px)]" aria-hidden />
                </div>
                <div className="flex items-center justify-between gap-2 bg-white px-3 py-2.5">
                  <span className="text-[13px] font-bold text-[#241f17] truncate">{scene.title}</span>
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[11px] font-bold px-3 py-1">
                    ▶ {T.hero.showcasePlay}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* 시나리오 인디케이터 */}
      <div className="flex justify-center gap-2 mt-4">
        {scenes.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`scene ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-gradient-to-r from-[#2563eb] to-[#06b6d4]' : 'w-1.5 bg-[#ddd3bf] hover:bg-[#b3a78f]'}`}
          />
        ))}
      </div>
    </div>
  )
}
