'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'

// 프롬프트 카드 — 그라디언트 보더 + 멀티라인 입력 + 카드 안 하단 바(예시 칩 / BUILD 버튼)
export default function HeroPromptInput() {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  // 아무것도 안 치고 있으면 예시 프롬프트가 자동 타이핑된다 (포커스하면 사라지고 새로 입력)
  const [ghost, setGhost] = useState('')
  const router = useRouter()
  const { T, lang } = useLang()

  useEffect(() => {
    if (focused || value) {
      setGhost('')
      return
    }
    const examples = T.hero.chips.map(c => {
      const body = c.replace(/^\S+\s/, '')
      return lang === 'ko' ? `${body} 게임 만들어줘` : `Make me ${body.toLowerCase()}`
    })
    let ex = 0
    let ch = 0
    let hold = 0
    const id = setInterval(() => {
      const target = examples[ex]
      if (ch < target.length) {
        ch++
        setGhost(target.slice(0, ch))
      } else if (hold < 20) {
        hold++
      } else {
        ex = (ex + 1) % examples.length
        ch = 0
        hold = 0
        setGhost('')
      }
    }, 80)
    return () => clearInterval(id)
  }, [focused, value, lang, T])

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
          <div className="relative">
            {/* 자동 타이핑 고스트 — 입력 전까지만 보인다 */}
            {ghost && !value && !focused && (
              <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-4 text-sm md:text-base text-[#a1957f] text-left whitespace-pre-wrap" aria-hidden>
                {ghost}
                <span className="inline-block w-[2px] h-[1em] bg-[#2563eb] ml-0.5 align-middle animate-pulse" />
              </div>
            )}
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit(e)
                }
              }}
              rows={3}
              placeholder={ghost ? '' : T.hero.promptPlaceholder}
              aria-label={T.hero.promptPlaceholder}
              className="w-full resize-none bg-transparent px-5 pt-4 pb-1 text-sm md:text-base text-[#241f17] placeholder-[#a1957f] outline-none text-left"
            />
          </div>
          <div className="flex items-center justify-end px-3 pb-3">
            {/* linearity 스타일 필 버튼 — 흰 갭 + 헤일로 링 + 글로우 */}
            <button
              type="submit"
              className="shrink-0 rounded-full text-[13px] font-bold text-white px-6 py-2.5 bg-gradient-to-r from-[#2563eb] to-[#06b6d4] shadow-[0_0_0_2px_#ffffff,0_0_0_3.5px_rgba(37,99,235,0.22),0_6px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3.5px_rgba(37,99,235,0.4),0_8px_26px_rgba(37,99,235,0.45)] active:scale-[0.98] transition-all"
            >
              {T.hero.promptCta}
            </button>
          </div>
        </div>
      </div>

      {/* 예시 프롬프트 — 입력창 아래에 자연스럽게 이어지는 칩. 누르면 프롬프트에 채워짐 */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
        {T.hero.chips.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => setValue(chip.replace(/^\S+\s/, ''))}
            className="rounded-full border border-[#ddd3bf] bg-white/70 backdrop-blur-sm px-3.5 py-1.5 text-[12px] text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-white transition-colors whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>
    </form>
  )
}
