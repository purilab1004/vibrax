'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'

// 프롬프트 카드 — 그라디언트 보더 + 멀티라인 입력 + 카드 안 하단 바(예시 칩 / BUILD 버튼)
export default function HeroPromptInput() {
  const [value, setValue] = useState('')
  const router = useRouter()
  const { T } = useLang()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const prompt = value.trim()
    if (!prompt) return
    try {
      sessionStorage.setItem(INITIAL_PROMPT_KEY, prompt)
    } catch {}
    router.push('/studio')
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl">
      <div className="prompt-ring rounded-2xl p-[1.5px] shadow-[0_12px_40px_rgba(37,99,235,0.16)] focus-within:shadow-[0_16px_52px_rgba(37,99,235,0.28)] transition-shadow">
        <div className="rounded-[14.5px] bg-white overflow-hidden">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            rows={3}
            placeholder={T.hero.promptPlaceholder}
            aria-label={T.hero.promptPlaceholder}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-1 text-sm md:text-base text-[#241f17] placeholder-[#a1957f] outline-none text-left"
          />
          <div className="flex items-center gap-2 px-3 pb-3">
            {/* 예시 칩 — 누르면 프롬프트에 채워짐 */}
            <div className="hidden sm:flex items-center gap-2 min-w-0 overflow-hidden">
              {T.hero.chips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setValue(chip.replace(/^\S+\s/, ''))}
                  className="shrink-0 rounded-full border border-[#ebe4d6] bg-[#fcfaf5] px-3 py-1.5 text-[12px] text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {/* linearity 스타일 필 버튼 — 흰 갭 + 헤일로 링 + 글로우 */}
            <button
              type="submit"
              className="shrink-0 rounded-full text-[13px] font-bold text-white px-6 py-2.5 bg-gradient-to-r from-[#2563eb] to-[#06b6d4] shadow-[0_0_0_2px_#ffffff,0_0_0_3.5px_rgba(37,99,235,0.22),0_6px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3.5px_rgba(37,99,235,0.4),0_8px_26px_rgba(37,99,235,0.45)] active:scale-[0.98] transition-all"
            >
              ▶ {T.hero.promptCta}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[13px] text-[#6b6152] mt-3.5">{T.hero.promptHint}</p>
    </form>
  )
}
