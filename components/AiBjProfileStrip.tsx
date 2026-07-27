import Image from 'next/image'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

interface Props {
  genre: Genre
}

export default function AiBjProfileStrip({ genre }: Props) {
  const persona = AJ_PERSONAS[genre]

  return (
    <div className={`flex items-center gap-3 mb-5 px-3 py-2.5 border border-[#e8dfcf] border-l-2 ${persona.borderColor} bg-[#fffdf8]`}>
      <div className={`w-9 h-9 shrink-0 rounded-full border-2 ${persona.borderColor} overflow-hidden`}>
        <Image
          src="/aibot.png"
          alt={persona.name}
          width={36}
          height={36}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-pixel text-[11px] text-[#241f17]">{persona.name}</span>
          <span className={`font-pixel text-[10px] px-1.5 py-0.5 text-[#241f17] ${persona.tagColor}`}>
            AI AJ
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-red-500 font-pixel ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            LIVE
          </span>
        </div>
        <p className="text-[11px] text-[#857a68] truncate">{persona.catchphrase}</p>
      </div>
    </div>
  )
}
