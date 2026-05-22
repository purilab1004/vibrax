'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

export default function AboutPage() {
  const { T } = useLang()
  const a = T.about
  const [h1, h2] = a.heading.split('\n')
  const phases = [a.p1, a.p2, a.p3]

  const phaseAccent = [
    { border: 'border-[#00ff41]', text: 'text-[#00ff41]', bg: 'bg-[#00ff41]/5' },
    { border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/5' },
    { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/5' },
  ]

  return (
    <div className="relative overflow-hidden">
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
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
        <p className="font-pixel text-[#00ff41] text-[9px] tracking-[0.4em] mb-6">{a.badge}</p>
        <h1 className="font-pixel text-white text-xl md:text-3xl leading-[2]">
          {h1}<br />
          <span className="text-[#00ff41]">{h2}</span>
        </h1>
      </section>

      <div className="max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>

      {/* 3 Phases */}
      <section className="max-w-3xl mx-auto px-6 py-16 space-y-0">
        {phases.map((p, i) => {
          const accent = phaseAccent[i]
          return (
            <div key={i} className={`border-l-2 ${accent.border} pl-8 py-12 relative`}>
              {/* Phase number bubble */}
              <div className={`absolute -left-[13px] top-12 w-6 h-6 rounded-full ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                <span className={`font-pixel text-[8px] ${accent.text}`}>{i + 1}</span>
              </div>

              <p className={`font-pixel text-[9px] ${accent.text} tracking-widest mb-2`}>{p.phase}</p>
              <p className="font-pixel text-[10px] text-gray-500 tracking-widest mb-6">{p.label}</p>
              <blockquote className="text-xl md:text-2xl font-semibold text-white leading-relaxed mb-6">
                {p.quote}
              </blockquote>
              <p className="text-gray-300 text-sm md:text-base leading-[2] max-w-2xl">{p.body}</p>

              {i < phases.length - 1 && (
                <div className="flex items-center gap-4 mt-12 -ml-8 pl-8">
                  <div className={`h-px flex-1 ${i === 0 ? 'bg-blue-900/40' : 'bg-purple-900/40'}`} />
                  <span className={`font-pixel text-[9px] ${phaseAccent[i + 1].text} tracking-widest`}>▼</span>
                  <div className={`h-px flex-1 ${i === 0 ? 'bg-blue-900/40' : 'bg-purple-900/40'}`} />
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <div className="border border-[#00ff41]/30 bg-[#00ff41]/5 p-8 md:p-12 text-center">
          <p className="font-pixel text-[#00ff41] text-[9px] tracking-widest mb-6">{a.s5.label}</p>
          <p className="text-white text-xl md:text-2xl font-semibold leading-relaxed mb-3">{a.s5.heading}</p>
          <p className="text-2xl md:text-3xl font-bold text-[#00ff41] mb-8">{a.s5.cta}</p>
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
      </div>
    </div>
  )
}
