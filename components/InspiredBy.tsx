'use client'
// 홈 히어로 — "다음 플랫폼의 게임과 크리에이터에게서 영감을 받았습니다" 로고 마퀴 (TOP AI AVATAR 위, 같은 슬라이딩 방식·반대 방향)
// 아이콘: simple-icons(CC0) SVG, 상표는 각 소유자에게 있음. 단색으로 표시해 제휴로 오해되지 않게 한다.
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
  { name: 'PlayStation', icon: 'playstation' },
  { name: 'Nintendo', icon: 'nintendo' },
]

export default function InspiredBy() {
  const { T } = useLang()
  return (
    <div className="w-full">
      <p className="text-center text-[12px] md:text-[13px] font-semibold tracking-[0.04em] text-[#4a4337] mb-4">{T.games.inspiredBy}</p>
      <div className="hero-marquee relative overflow-hidden max-w-xl md:max-w-3xl mx-auto" aria-label={T.games.inspiredBy}>
        {/* 동일 리스트 두 벌 — TOP AI AVATAR 와 같은 트랙, 반대 방향·조금 느리게 */}
        <div className="hero-marquee-track flex w-max will-change-transform" style={{ animationDuration: '36s', animationDirection: 'reverse' }}>
          {[0, 1].map(copy => (
            <div key={copy} className="flex items-center gap-9 md:gap-11 pr-9 md:pr-11" aria-hidden={copy === 1}>
              {BRANDS.map(b => (
                <span key={`${b.icon}-${copy}`} className="shrink-0 flex items-center gap-2.5 whitespace-nowrap text-[#241f17] select-none" title={b.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brands/${b.icon}.svg`} alt="" width={28} height={28} className="w-6 h-6 md:w-7 md:h-7 opacity-80" loading="lazy" />
                  <span className="text-[16px] md:text-[18px] font-extrabold tracking-tight opacity-85">{b.name}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
