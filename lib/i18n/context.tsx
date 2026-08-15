'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Lang } from './translations'
import { t } from './translations'

interface LangContextType {
  lang: Lang
  T: typeof t.ko
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextType>({
  lang: 'ko',
  T: t.ko,
  setLang: () => {},
})

export function LangProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  initialLang: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = (l: Lang) => {
    setLangState(l)
    document.cookie = `vibrax-lang=${l}; path=/; max-age=31536000; SameSite=Lax`
  }

  return (
    <LangContext.Provider value={{ lang, T: t[lang], setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
