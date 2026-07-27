'use client'

import { useLang } from '@/lib/i18n/context'

export interface LegalSection { h: string; p: string[] }
export interface LegalDoc { title: string; updated: string; sections: LegalSection[] }

export default function LegalPage({ ko, en }: { ko: LegalDoc; en: LegalDoc }) {
  const { lang } = useLang()
  const d = lang === 'ko' ? ko : en
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-pixel text-[#0e7573] text-base tracking-widest mb-2">{d.title}</h1>
      <p className="text-xs text-[#9d9280] mb-10">{d.updated}</p>
      <div className="space-y-8">
        {d.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-[#241f17] font-bold text-base mb-3">{s.h}</h2>
            {s.p.map((t, j) => (
              <p key={j} className="text-[#4a4337] text-sm leading-7 mb-2">{t}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
