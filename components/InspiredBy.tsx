'use client'
// 홈 히어로 — "다음 플랫폼의 게임과 크리에이터에게서 영감을 받았습니다" 로고 스트립 (TOP AI AVATAR 위)
// 아이콘: simple-icons(CC0) SVG, 상표는 각 소유자에게 있음. 단색·저채도로 표시해 제휴로 오해되지 않게 한다.
import { useLang } from '@/lib/i18n/context'

const BRANDS: { name: string; icon: string }[] = [
  { name: 'Steam', icon: 'steam' },
  { name: 'Roblox', icon: 'roblox' },
  { name: 'Unity', icon: 'unity' },
  { name: 'itch.io', icon: 'itchdotio' },
  { name: 'IGN', icon: 'ign' },
  { name: 'Scratch', icon: 'scratch' },
  { name: 'Minecraft', icon: 'minecraft' },
  { name: 'Epic Games', icon: 'epicgames' },
]

export default function InspiredBy() {
  const { T } = useLang()
  return (
    <div className="w-full px-6" aria-label={T.games.inspiredBy}>
      <p className="text-center text-[11px] md:text-[12px] font-medium tracking-[0.06em] text-[#857a68]">{T.games.inspiredBy}</p>
      <ul className="mt-3 flex items-center justify-center gap-x-7 gap-y-3 flex-wrap max-w-5xl mx-auto">
        {BRANDS.map(b => (
          <li key={b.icon} className="flex items-center gap-1.5 text-[#9d9280] opacity-70 hover:opacity-100 transition-opacity select-none" title={b.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brands/${b.icon}.svg`} alt="" width={16} height={16} className="w-4 h-4 opacity-60" style={{ filter: 'grayscale(1)' }} loading="lazy" />
            <span className="text-[12.5px] md:text-[13.5px] font-bold tracking-tight">{b.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
