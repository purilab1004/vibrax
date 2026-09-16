'use client'
// 모바일 검색 — iOS 검색창처럼 전체 화면으로 열린다: 큰 입력창(16px, 자동 포커스, 지우기), 닫기(X),
// 입력 전엔 최근 검색·카테고리·인기 게임, 입력 중엔 실시간 제목 제안. Enter 또는 제안 탭 → /games?q= (또는 게임 상세).
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GenreFilter from '@/components/GenreFilter'

interface Sug { id: string; title: string; genre: string; thumbnail_url: string | null; view_count: number | null }
const RECENT_KEY = 'vbx_recent_search'
const readRecent = (): string[] => { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter((s) => typeof s === 'string').slice(0, 8) : [] } catch { return [] } }
const pushRecent = (t: string) => { try { const a = [t, ...readRecent().filter((s) => s !== t)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(a)) } catch { /* noop */ } }

export default function MobileSearch({ open, onClose, categories }: { open: boolean; onClose: () => void; categories?: React.ReactNode | ((close: () => void) => React.ReactNode) }) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState('')
  const [sug, setSug] = useState<Sug[]>([])
  const [popular, setPopular] = useState<Sug[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => { setQ(params.get('q') ?? ''); setRecent(readRecent()); inputRef.current?.focus() }, 30)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose, params])

  // 인기 게임(한 번) + 실시간 제안(입력 250ms 뒤)
  useEffect(() => {
    if (!open) return
    const sb = createClient()
    if (!popular.length) sb.from('games').select('id,title,genre,thumbnail_url,view_count').order('view_count', { ascending: false }).limit(6).then(({ data }) => setPopular((data ?? []) as Sug[]))
    const term = q.trim()
    if (!term) { const t0 = setTimeout(() => setSug([]), 0); return () => clearTimeout(t0) }
    let alive = true
    const t = setTimeout(() => {
      sb.from('games').select('id,title,genre,thumbnail_url,view_count').ilike('title', `%${term.replace(/[%_]/g, '')}%`).order('view_count', { ascending: false }).limit(8)
        .then(({ data }) => { if (alive) setSug((data ?? []) as Sug[]) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [open, q, popular.length])

  const search = (term: string) => {
    const t = term.trim()
    const p = new URLSearchParams(params.toString())
    if (t) { p.set('q', t); pushRecent(t) } else p.delete('q')
    const s = p.toString()
    onClose()
    router.push(`/games${s ? `?${s}` : ''}`)
  }
  const goGame = (g: Sug) => { pushRecent(g.title); onClose(); router.push(`/games/${g.id}`) }

  if (!open) return null
  const term = q.trim()
  const Row = ({ g }: { g: Sug }) => (
    <button onClick={() => goGame(g)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-[#f3eee3]">
      {g.thumbnail_url ? <img src={g.thumbnail_url} alt="" className="w-11 h-11 rounded-xl object-cover bg-[#eee6d6] shrink-0" /> : <span className="w-11 h-11 rounded-xl bg-[#eee6d6] shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-[#241f17] truncate">{highlight(g.title, term)}</span>
        <span className="block text-[11px] text-[#9d9280] font-pixel tracking-wider">{g.genre.toUpperCase()} · {(g.view_count ?? 0).toLocaleString()} views</span>
      </span>
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#c9bfa8] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  )
  return (
    <div className="md:hidden fixed inset-0 z-[90] bg-[#fcfaf5] flex flex-col" style={{ paddingTop: 'var(--st, 0px)' }} role="dialog" aria-modal="true" aria-label="검색">
      {/* 입력 줄 */}
      <form onSubmit={(e) => { e.preventDefault(); search(q) }} className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex-1 flex items-center h-12 rounded-2xl bg-white border border-[#e3dccb] shadow-[0_2px_10px_rgba(36,31,23,0.06)] focus-within:border-[#2563eb] px-3 gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#9d9280] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="게임 검색" enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#241f17] placeholder:text-[#b3a78f]" />
          {q && <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label="지우기" className="w-6 h-6 rounded-full bg-[#d8cfbb] text-white flex items-center justify-center text-[12px] leading-none">✕</button>}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="h-12 w-12 rounded-2xl bg-white border border-[#e3dccb] text-[#241f17] flex items-center justify-center text-[18px] shrink-0">✕</button>
      </form>
      {/* 본문 */}
      <div className="flex-1 overflow-y-auto pb-[max(24px,env(safe-area-inset-bottom))]">
        {term ? (
          <>
            <button onClick={() => search(q)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#f3eee3]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#2563eb] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <span className="text-[15px] text-[#241f17]">&ldquo;{term}&rdquo; <span className="text-[#9d9280]">검색</span></span>
            </button>
            {sug.map((g) => <Row key={g.id} g={g} />)}
            {!sug.length && <p className="px-4 py-6 text-center text-[13px] text-[#9d9280]">일치하는 게임이 없어요. Enter 로 전체 검색</p>}
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <section className="px-4 pt-3">
                <div className="flex items-center justify-between mb-2"><h3 className="text-[11px] font-bold tracking-[0.18em] text-[#9d9280]">최근 검색</h3><button onClick={() => { try { localStorage.removeItem(RECENT_KEY) } catch { /* noop */ } setRecent([]) }} className="text-[11px] text-[#9d9280]">지우기</button></div>
                <div className="flex flex-wrap gap-2">{recent.map((r) => <button key={r} onClick={() => search(r)} className="h-9 px-3.5 rounded-full bg-white border border-[#e3dccb] text-[13px] text-[#4a4337]">{r}</button>)}</div>
              </section>
            )}
            <section className="px-4 pt-5">
              <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#9d9280] mb-2">카테고리</h3>
              <div className="[&_a]:!h-9 [&_button]:!h-9">{typeof categories === 'function' ? categories(onClose) : (categories ?? <GenreFilter />)}</div>
            </section>
            {popular.length > 0 && (
              <section className="pt-5">
                <h3 className="px-4 text-[11px] font-bold tracking-[0.18em] text-[#9d9280] mb-1">인기 게임</h3>
                {popular.map((g) => <Row key={g.id} g={g} />)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function highlight(title: string, term: string) {
  if (!term) return title
  const i = title.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return title
  return <>{title.slice(0, i)}<b className="font-bold text-[#2563eb]">{title.slice(i, i + term.length)}</b>{title.slice(i + term.length)}</>
}
