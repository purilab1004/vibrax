'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'
import { INITIAL_PROMPT_KEY } from '@/lib/studio/constants'

export default function HeroPromptInput({ onBlue = false }: { onBlue?: boolean }) {
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
      <div className={`flex items-stretch bg-white rounded-2xl border-2 transition-all overflow-hidden ${
        onBlue
          ? 'border-white/60 shadow-[0_14px_44px_rgba(23,37,84,0.35)] focus-within:shadow-[0_16px_56px_rgba(23,37,84,0.5)] focus-within:-translate-y-0.5'
          : 'border-[#2563eb] shadow-[0_10px_36px_rgba(37,99,235,0.18)] focus-within:shadow-[0_10px_44px_rgba(37,99,235,0.32)] focus-within:-translate-y-0.5'
      }`}>
        <span className="hidden sm:flex items-center pl-5 text-lg" aria-hidden>✨</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={T.hero.promptPlaceholder}
          aria-label={T.hero.promptPlaceholder}
          className="flex-1 min-w-0 bg-transparent px-4 sm:px-3 py-5 text-sm md:text-base text-[#241f17] placeholder-[#a1957f] outline-none"
        />
        <button
          type="submit"
          className="m-2 rounded-xl text-[13px] font-bold bg-[#2563eb] text-white px-7 hover:bg-[#1d4ed8] active:scale-[0.98] transition-all shrink-0"
        >
          ▶ {T.hero.promptCta}
        </button>
      </div>
      <p className={`text-[13px] mt-3.5 ${onBlue ? 'text-white/85' : 'text-[#6b6152]'}`}>{T.hero.promptHint}</p>
    </form>
  )
}
