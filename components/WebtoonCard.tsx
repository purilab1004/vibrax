'use client'
// 웹툰 쇼츠 카드 — 컷을 탭으로 넘겨 본다(인스타 스토리 방식).
//  · 오른쪽을 탭하면 다음 컷, 왼쪽을 탭하면 이전 컷 (좌우 스와이프도 동작)
//  · 상단에 컷 진행 막대, 마지막 컷에서 다음을 누르면 '다시 보기 / 게임 하러 가기'
//  · 게임을 연결해 두면 마지막에 그 게임으로 바로 갈 수 있다
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Webtoon } from '@/lib/supabase/types'
import { titleFont } from '@/lib/fonts'
import { countryFlag, flagRingStyle } from '@/lib/country'
import { avatarPreviewUrl } from '@/lib/jeumto/config'
import { useFeedTrack } from '@/lib/feedBgm'

export default function WebtoonCard({ webtoon, layout, priority = false }: { webtoon: Webtoon; layout: 'feed-mobile' | 'feed-desktop'; priority?: boolean }) {
  const cuts = Array.isArray(webtoon.cuts) ? webtoon.cuts.filter(c => c?.url) : []
  const [i, setI] = useState(0)
  const [done, setDone] = useState(false)         // 마지막 컷까지 다 봤을 때
  const rootRef = useRef<HTMLDivElement>(null)
  const viewed = useRef(false)
  useFeedTrack(rootRef, 'webtoon')

  // 카드가 화면에 들어오면 조회수 1회
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      if (viewed.current) return
      viewed.current = true
      createClient().rpc('bump_webtoon_view' as never, { p_id: webtoon.id } as never).then(() => {}, () => {})
    }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [webtoon.id])

  const go = (dir: 1 | -1) => {
    setI(prev => {
      const next = prev + dir
      if (next < 0) return 0
      if (next >= cuts.length) { setDone(true); return prev }
      setDone(false)
      return next
    })
  }

  // 좌우 스와이프
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent) => { touch.current = { x: e.clientX, y: e.clientY } }
  const onUp = (e: React.PointerEvent) => {
    const t = touch.current; touch.current = null
    if (!t) return
    const dx = e.clientX - t.x, dy = e.clientY - t.y
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) return       // 세로 스크롤은 피드에 양보
    if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); return }
    // 탭 — 왼쪽 1/3 은 이전, 나머지는 다음
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1)
  }

  const creator = webtoon.profiles?.agent_name ?? webtoon.profiles?.username ?? 'unknown'
  const avatarUrl = avatarPreviewUrl(webtoon.profiles?.avatar_config)
  const cut = cuts[i]
  const mobile = layout === 'feed-mobile'

  return (
    <div
      ref={rootRef}
      className={mobile ? 'feed-snap relative h-[100svh] overflow-hidden bg-[#0b0910]' : 'feed-snap relative w-full max-w-[420px] mx-auto rounded-3xl overflow-hidden bg-[#0b0910] border border-black/10 shadow-[0_18px_44px_-24px_rgba(0,0,0,.5)]'}
      style={mobile ? undefined : { height: 'min(calc(100svh - 5.5rem), 760px)' }}
    >
      {/* 배경 — 현재 컷을 크게 흐려 채운다 */}
      {cut && (
        <Image src={cut.url} alt="" fill sizes="30vw" quality={25} priority={priority} loading={priority ? undefined : 'lazy'} className="object-cover" style={{ filter: 'blur(28px) saturate(1.1)', transform: 'scale(1.2)', opacity: 0.55 }} />
      )}

      {/* 컷 — 탭으로 넘긴다 */}
      <div className="absolute inset-0 touch-pan-y select-none" onPointerDown={onDown} onPointerUp={onUp}>
        {cut && (
          <Image
            key={cut.url}
            src={cut.url} alt={`${webtoon.title} ${i + 1}컷`} fill sizes="100vw" quality={82}
            priority={priority && i === 0} loading={priority && i === 0 ? undefined : 'lazy'}
            className="object-contain wt-cut-in"
          />
        )}
        {/* 다음 컷 미리 받아두기 — 탭했을 때 바로 나오게 */}
        {cuts[i + 1] && <link rel="preload" as="image" href={cuts[i + 1].url} />}
      </div>

      {/* 상단 진행 막대 */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3" style={{ paddingTop: mobile ? 'calc(10px + var(--st, 0px))' : '10px' }}>
        {cuts.map((_, k) => (
          <span key={k} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/25">
            <span className="block h-full rounded-full bg-white transition-[width] duration-200" style={{ width: k < i ? '100%' : k === i ? '100%' : '0%', opacity: k <= i ? 1 : 0 }} />
          </span>
        ))}
      </div>

      {/* 웹툰 라벨 */}
      <span className="absolute top-8 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white"
        style={mobile ? { top: 'calc(28px + var(--st, 0px))' } : undefined}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff2d6f]" />WEBTOON
        <span className="text-white/60 font-bold">{i + 1}/{cuts.length}</span>
      </span>

      {/* 다 본 뒤 — 다시 보기 / 게임으로 */}
      {done && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/72 backdrop-blur-sm px-8 text-center">
          <div>
            <p className={`${titleFont.className} text-[26px] text-white leading-snug`}>{webtoon.title}</p>
            <p className="mt-1.5 text-[13px] text-white/60">{cuts.length}컷을 모두 봤어요</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {webtoon.game_id && (
                <Link href={`/games/${webtoon.game_id}`} className="h-12 px-6 rounded-full bg-gradient-to-b from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] text-[15px] font-extrabold grid place-items-center active:translate-y-0.5 transition-transform">
                  ▶ 이 웹툰의 게임 하러 가기
                </Link>
              )}
              <button onClick={() => { setI(0); setDone(false) }} className="h-11 px-6 rounded-full border border-white/25 text-white text-[14px] font-bold">처음부터 다시 보기</button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 정보 */}
      <div className={`absolute inset-x-0 bottom-0 z-20 px-5 pt-14 bg-gradient-to-t from-black/75 via-black/35 to-transparent ${mobile ? 'pb-28' : 'pb-6'}`}>
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
          <span className="avatar-ring" style={flagRingStyle(webtoon.profiles?.country)}>
            <span className="w-6 h-6 shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center bg-white/10">
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt={creator} className="w-full h-full object-cover object-top" />
                : <span className="font-pixel text-[10px] text-white">{creator.charAt(0).toUpperCase()}</span>}
            </span>
          </span>
          {creator}{countryFlag(webtoon.profiles?.country) && <span className="ml-1">{countryFlag(webtoon.profiles?.country)}</span>}
        </p>
        <p className="mt-1.5 text-[17px] font-extrabold leading-snug text-white [text-shadow:0_1px_6px_rgba(0,0,0,.7)]" style={{ wordBreak: 'keep-all' }}>{webtoon.title}</p>
        {webtoon.intro && <p className="mt-1 text-[14px] text-white/70 line-clamp-2" style={{ wordBreak: 'keep-all' }}>{webtoon.intro}</p>}
        <p className="mt-2 text-[12px] text-white/45">{done ? '다시 보려면 위 버튼을 누르세요' : '화면을 탭하면 다음 컷 · 왼쪽을 탭하면 이전 컷'}</p>
      </div>
    </div>
  )
}
