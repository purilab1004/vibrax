'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'

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
      <div className="flex items-stretch bg-[#ffffff]/90 border-2 border-[#0284c7] focus-within:shadow-[0_0_24px_rgba(2,132,199,0.25)] transition-shadow">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={T.hero.promptPlaceholder}
          aria-label={T.hero.promptPlaceholder}
          className="flex-1 min-w-0 bg-transparent px-5 py-4 text-sm md:text-base text-[#241f17] placeholder-[#a1957f] outline-none"
        />
        <button
          type="submit"
          className="font-pixel text-[11px] bg-[#0284c7] text-white px-6 hover:bg-[#0369a1] transition-colors shrink-0"
        >
          {T.hero.promptCta}
        </button>
      </div>
      <p className="text-xs text-[#6b6152] mt-3">{T.hero.promptHint}</p>
    </form>
  )
}
