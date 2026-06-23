// components/avatar/CatalogPicker.tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import { CATALOG } from '@/lib/avatar/catalog'
import type { PartCategory, Selection } from '@/lib/avatar/catalog'

const EYE_COLORS = ['#5b3a29', '#2b2b2b', '#1f5fa8', '#3f8f4f', '#7a3f8f', '#a83232']
const EXPRESSIONS = [
  { name: 'neutral', label: '기본' }, { name: 'happy', label: '미소' },
  { name: 'angry', label: '화남' }, { name: 'sad', label: '슬픔' }, { name: 'surprised', label: '놀람' },
]

interface Props {
  selection: Selection
  eyeColor: string | null
  onSelect: (cat: PartCategory, variantId: string | null) => void
  onEyeColor: (hex: string | null) => void
  onExpression: (name: string, value: number) => void
}

export default function CatalogPicker({ selection, eyeColor, onSelect, onEyeColor, onExpression }: Props) {
  const [tab, setTab] = useState<PartCategory | 'eye' | 'expr'>('tops')
  const tabClass = (active: boolean) =>
    `font-pixel text-[9px] px-3 py-2 tracking-widest transition-colors ${active ? 'bg-[#00ff41] text-black' : 'text-gray-400 hover:text-white border border-gray-800'}`

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
        {CATALOG.map((c) => <button key={c.id} onClick={() => setTab(c.id)} className={tabClass(tab === c.id)}>{c.label}</button>)}
        <button onClick={() => setTab('eye')} className={tabClass(tab === 'eye')}>눈색</button>
        <button onClick={() => setTab('expr')} className={tabClass(tab === 'expr')}>표정</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {CATALOG.filter((c) => c.id === tab).map((c) => (
          <div key={c.id} className="grid grid-cols-3 gap-2">
            {c.allowNone && (
              <button onClick={() => onSelect(c.id, null)}
                className={`aspect-square border flex items-center justify-center text-[9px] font-pixel ${selection[c.id] == null ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-500'}`}>없음</button>
            )}
            {c.variants.map((v) => (
              <button key={v.id} onClick={() => onSelect(c.id, v.id)}
                className={`relative aspect-square border overflow-hidden ${selection[c.id] === v.id ? 'border-[#00ff41]' : 'border-gray-800 hover:border-gray-600'}`}>
                <Image src={v.thumb} alt={v.label} fill className="object-cover" unoptimized />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white py-0.5 text-center truncate">{v.label}</span>
              </button>
            ))}
          </div>
        ))}
        {tab === 'eye' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onEyeColor(null)} className={`w-9 h-9 border ${eyeColor == null ? 'border-[#00ff41]' : 'border-gray-800'} text-[8px] text-gray-400 font-pixel`}>기본</button>
            {EYE_COLORS.map((hex) => (
              <button key={hex} onClick={() => onEyeColor(hex)} style={{ background: hex }}
                className={`w-9 h-9 border-2 ${eyeColor === hex ? 'border-[#00ff41]' : 'border-transparent'}`} />
            ))}
          </div>
        )}
        {tab === 'expr' && (
          <div className="flex flex-wrap gap-2">
            {EXPRESSIONS.map((e) => (
              <button key={e.name} onClick={() => onExpression(e.name, e.name === 'neutral' ? 0 : 1)}
                className="font-pixel text-[9px] border border-gray-800 text-gray-300 hover:border-[#00ff41] px-3 py-2 tracking-widest">{e.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
