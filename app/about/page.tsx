'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

export default function AboutPage() {
  const { T } = useLang()
  const a = T.about
  const [h1, h2] = a.heading.split('\n')

  return (
    <div className="relative overflow-hidden">
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#00ff41 1px, transparent 1px),
            linear-gradient(90deg, #00ff41 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="font-pixel text-[#00ff41] text-[9px] tracking-[0.4em] mb-6">
          {a.badge}
        </p>
        <h1 className="font-pixel text-white text-xl md:text-3xl leading-[2]">
          {h1}<br />
          <span className="text-[#00ff41]">{h2}</span>
        </h1>
      </section>

      <div className="max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-20">

        {[a.s1, a.s2, a.s3, a.s4].map((s, i) => (
          <div key={i}>
            <p className="font-pixel text-[#00ff41] text-[9px] tracking-widest mb-5">{s.label}</p>
            <blockquote className="text-2xl md:text-3xl font-semibold text-white leading-relaxed mb-6">
              {s.quote}
            </blockquote>
            <p className="text-gray-300 text-sm md:text-base leading-[2] max-w-2xl">{s.body}</p>
            {i < 3 && (
              <div className="flex items-center gap-4 mt-20">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="font-pixel text-[#00ff41] text-[9px] tracking-widest">▼</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-800" />
          <span className="font-pixel text-[#00ff41] text-[9px] tracking-widest">▼</span>
          <div className="h-px flex-1 bg-gray-800" />
        </div>

        {/* Final CTA */}
        <div className="border border-[#00ff41]/30 bg-[#00ff41]/5 p-8 md:p-12 text-center">
          <p className="font-pixel text-[#00ff41] text-[9px] tracking-widest mb-6">{a.s5.label}</p>
          <p className="text-white text-xl md:text-2xl font-semibold leading-relaxed mb-4">{a.s5.heading}</p>
          <p className="text-3xl md:text-4xl font-bold text-[#00ff41] mb-8">{a.s5.cta}</p>
          <p className="text-gray-300 text-sm leading-[2] mb-10 max-w-lg mx-auto">{a.s5.body}</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/games" className="font-pixel text-[11px] bg-[#00ff41] text-black px-8 py-4 hover:bg-[#00cc33] transition-colors tracking-widest">
              {a.s5.btn1}
            </Link>
            <Link href="/submit" className="font-pixel text-[11px] border border-[#00ff41] text-[#00ff41] px-8 py-4 hover:bg-[#00ff41] hover:text-black transition-colors tracking-widest">
              {a.s5.btn2}
            </Link>
          </div>
        </div>

      </section>
    </div>
  )
}
