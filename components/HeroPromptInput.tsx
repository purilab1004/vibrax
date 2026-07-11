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
      <div className="flex items-stretch bg-[#0d0d0d]/90 border-2 border-[#00ff41] focus-within:shadow-[0_0_24px_rgba(0,255,65,0.25)] transition-shadow">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={T.hero.promptPlaceholder}
          aria-label={T.hero.promptPlaceholder}
          className="flex-1 min-w-0 bg-transparent px-5 py-4 text-sm md:text-base text-white placeholder-gray-500 outline-none"
        />
        <button
          type="submit"
          className="font-pixel text-[11px] bg-[#00ff41] text-black px-6 hover:bg-[#00cc33] transition-colors shrink-0"
        >
          {T.hero.promptCta}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">{T.hero.promptHint}</p>
    </form>
  )
}
