'use client'
// 모바일 /games — 상단을 가리지 않도록 검색·카테고리를 작은 버튼 뒤로 숨긴다.
// 버튼을 누르면 유리 패널이 내려와 검색 입력 + 장르 알약이 나온다.
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GenreFilter from '@/components/GenreFilter'

export default function MobileGamesTools() {
  const router = useRouter()
  const params = useSearchParams()
  // 열림 상태를 쿼리 문자열과 함께 기억 → 쿼리가 바뀌면(장르/검색 적용) 자동으로 닫힌 것으로 취급
  const key = params.toString()
  const [openState, setOpenState] = useState<{ key: string; open: boolean }>({ key, open: false })
  const open = openState.key === key && openState.open
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenState((s) => ({ key, open: typeof v === 'function' ? v(s.key === key && s.open) : v }))
  const [q, setQ] = useState(params.get('q') ?? '')
  const genre = params.get('genre')
  const active = !!(genre || params.get('q'))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams(params.toString())
    const term = q.trim()
    if (term) p.set('q', term); else p.delete('q')
    const s = p.toString()
    router.push(`/games${s ? `?${s}` : ''}`)
  }

  return (
    <div className="md:hidden">
      {/* 토글 버튼 — 우상단 작은 원 */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'close search' : 'search & filter'}
        className={`fixed top-3 right-3 z-[65] w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-[0_4px_16px_rgba(36,31,23,0.15)] transition-colors ${
          open || active ? 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white border-transparent' : 'bg-white/80 text-[#241f17] border-[#ebe4d6]'
        }`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        )}
      </button>

      {/* 패널 */}
      <div
        className={`fixed inset-x-0 top-0 z-[64] transition-transform duration-200 ${open ? 'translate-y-0' : '-translate-y-full pointer-events-none'}`}
      >
        <div className="mx-3 mt-16 rounded-2xl bg-white/85 backdrop-blur-xl border border-[#ebe4d6] shadow-[0_10px_30px_rgba(36,31,23,0.15)] p-3 space-y-3">
          <form onSubmit={submit} className="flex items-center rounded-full border border-[#ddd3bf] bg-white overflow-hidden focus-within:border-[#2563eb]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="게임 검색"
              className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-transparent outline-none text-[#241f17] placeholder:text-[#b3a78f]"
            />
            <button type="submit" aria-label="search" className="px-4 py-2.5 text-[#2563eb]">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </button>
          </form>
          <div className="flex justify-center"><GenreFilter /></div>
        </div>
      </div>
      {open && <button aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-[63] bg-black/20" />}
    </div>
  )
}
