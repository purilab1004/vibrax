'use client'
// 모바일 /games — 상단을 가리지 않도록 검색·카테고리를 작은 버튼 뒤로 숨긴다.
// 버튼을 누르면 유리 패널이 내려와 검색 입력 + 장르 알약이 나온다.
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MobileSearch from '@/components/MobileSearch'
import { useSoundPref, setSoundPref } from '@/lib/live/soundPref'

interface Props {
  /* 홈 등에서 카테고리 알약을 바꿔 끼울 때 */
  categories?: React.ReactNode | ((close: () => void) => React.ReactNode)
  /* false 면 버튼/패널을 숨긴다 (홈: 히어로 구간) */
  visible?: boolean
}

export default function MobileGamesTools({ categories, visible = true }: Props) {
  const params = useSearchParams()
  // 열림 상태를 쿼리 문자열과 함께 기억 → 쿼리가 바뀌면(장르/검색 적용) 자동으로 닫힌 것으로 취급
  const key = params.toString()
  const [openState, setOpenState] = useState<{ key: string; open: boolean }>({ key, open: false })
  const open = openState.key === key && openState.open
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenState((s) => ({ key, open: typeof v === 'function' ? v(s.key === key && s.open) : v }))
  const genre = params.get('genre')
  const sound = useSoundPref()
  const active = !!(genre || params.get('q'))

  if (!visible) return null
  return (
    <div className="md:hidden">
      {/* 공용 스피커 — 검색 아이콘처럼 상단에 고정. 한 번 켜면 게임·영상 쇼츠 모두 소리가 이어진다 */}
      {!open && (
        <button
          onClick={() => setSoundPref({ on: !sound.on })}
          aria-label={sound.on ? '소리 끄기' : '소리 켜기'}
          className="fixed top-3 right-14 z-[65] w-10 h-10 flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            {sound.on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13" /> : <path d="M22 9l-6 6M16 9l6 6" />}
          </svg>
        </button>
      )}
      {/* 토글 버튼 — 우상단 작은 원 */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'close search' : 'search & filter'}
        className={`fixed top-3 right-3 z-[65] w-10 h-10 flex items-center justify-center transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] ${
          open || active ? 'text-[#7cc4ff]' : 'text-white'
        }`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        )}
      </button>

      {/* 전체 화면 검색 — 최근 검색·카테고리·인기 게임·실시간 제안 */}
      <MobileSearch open={open} onClose={() => setOpen(false)} categories={categories} />
    </div>
  )
}
