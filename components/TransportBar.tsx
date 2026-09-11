'use client'
// 게임 transport — 목표 점수를 달성(또는 클리어)하면 "다음 게임으로" 이동 화살표가 활성화된다. 사람이 후보 중 골라도 된다.
// 점수는 게임이 부모로 보내는 aj:event(score/over/clear) 를 텔레메트리가 window 'aj:game-event' 로 재발행한 것을 듣는다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Cand { id: string; title: string; genre: string; thumbnail_url: string; coin_cost: number; reason: string }
interface Info { goal: number | null; goalSource: 'admin' | 'auto' | 'finish'; next: Cand[] }
const CHAIN_KEY = 'vx_transport_chain'

export function readChain(): number { try { return Number(sessionStorage.getItem(CHAIN_KEY) ?? 0) || 0 } catch { return 0 } }

export default function TransportBar({ gameId, active }: { gameId: string; active: boolean }) {
  const router = useRouter()
  const [info, setInfo] = useState<Info | null>(null)
  const [score, setScore] = useState(0)
  const [reached, setReached] = useState(false)
  const [finished, setFinished] = useState(false)   // 게임오버/클리어 1회 이상
  const [pickOpen, setPickOpen] = useState(false)
  const [going, setGoing] = useState<string | null>(null)
  const [chain, setChain] = useState(0)
  const reachedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    let alive = true
    fetch(`/api/games/${gameId}/transport`).then(r => r.json()).then(j => { if (alive && j && !j.error) setInfo(j) }).catch(() => {})
    const t = setTimeout(() => setChain(readChain()), 0)
    return () => { alive = false; clearTimeout(t) }
  }, [gameId, active])

  useEffect(() => {
    if (!active) return
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; data: { score?: number } | null }>).detail
      if (!d) return
      const sc = typeof d.data?.score === 'number' ? d.data.score : null
      if (sc != null) setScore(s => Math.max(s, sc))
      if (d.name === 'over' || d.name === 'clear') setFinished(true)
      if (d.name === 'clear') setReached(true)
    }
    window.addEventListener('aj:game-event', h)
    return () => window.removeEventListener('aj:game-event', h)
  }, [active])

  // 목표 판정: 관리자/자동 목표가 있으면 점수 ≥ 목표, 없으면 한 판을 끝내면(게임오버·클리어) 이동 가능
  useEffect(() => {
    if (!info) return
    const ok = info.goal ? score >= info.goal : finished
    if (!ok || reached) return
    const t = setTimeout(() => { setReached(true); reachedAt.current = Date.now(); setPickOpen(true) }, 0)
    return () => clearTimeout(t)
  }, [info, score, finished, reached])

  const go = useCallback(async (c: Cand, picked: boolean) => {
    if (going) return
    setGoing(c.id)
    try { sessionStorage.setItem(CHAIN_KEY, String(readChain() + 1)) } catch { /* */ }
    try { await fetch(`/api/games/${gameId}/transport`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: c.id, score, goal: info?.goal ?? null, picked }), keepalive: true }) } catch { /* */ }
    router.push(`/games/${c.id}?play=1`)
  }, [gameId, going, info, router, score])

  if (!active || !info || info.next.length === 0) return null
  const goal = info.goal
  const pct = goal ? Math.min(100, Math.round((score / goal) * 100)) : (finished ? 100 : 0)
  const primary = info.next[0]

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[56px] md:bottom-3 z-30 flex flex-col items-center gap-2 px-3">
      {/* 후보 선택 카드 — 목표 달성 시 자동으로 펼쳐지고, 사람이 골라도 된다 */}
      {pickOpen && reached && (
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#0f1219]/92 backdrop-blur-md border border-white/12 shadow-[0_14px_40px_rgba(0,0,0,0.55)] p-3 transport-pop">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-[13px] font-bold">🎯 목표 달성! 다음 게임으로 이동할까요?</p>
            <button onClick={() => setPickOpen(false)} className="text-white/60 hover:text-white text-[12px]">나중에</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {info.next.map((c, i) => (
              <button key={c.id} onClick={() => go(c, i !== 0)} disabled={!!going} className={`group relative rounded-xl overflow-hidden border text-left transition-transform hover:scale-[1.03] disabled:opacity-60 ${i === 0 ? 'border-[#60a5fa] ring-2 ring-[#60a5fa]/40' : 'border-white/15'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail_url} alt={c.title} className="w-full aspect-video object-cover" />
                <div className="px-2 py-1.5 bg-black/40">
                  <p className="text-white text-[11.5px] font-semibold truncate">{c.title}</p>
                  <p className="text-white/55 text-[10px] truncate">{c.reason}{c.coin_cost > 1 ? ` · 🪙${c.coin_cost}` : ''}</p>
                </div>
                {i === 0 && <span className="absolute top-1 left-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#2563eb] text-white">추천</span>}
                {going === c.id && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[12px]">이동 중…</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 진행 바 + 이동 화살표 */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md border border-white/12 pl-3 pr-1.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
        {chain > 0 && <span className="text-[10.5px] font-bold text-[#fbbf24] whitespace-nowrap">🚀 {chain}연속</span>}
        <div className="flex flex-col min-w-[120px]">
          <div className="flex items-baseline justify-between gap-2 text-[10.5px] text-white/80 leading-none mb-1">
            <span>{goal ? `목표 ${goal.toLocaleString()}` : '한 판 끝내기'}</span>
            <span className="tabular-nums font-semibold text-white">{goal ? score.toLocaleString() : (finished ? '완료' : '진행 중')}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden"><div className={`h-full rounded-full transition-[width] duration-500 ${reached ? 'bg-[#22c55e]' : 'bg-[#60a5fa]'}`} style={{ width: `${pct}%` }} /></div>
        </div>
        <button
          onClick={() => reached ? (pickOpen ? go(primary, false) : setPickOpen(true)) : undefined}
          disabled={!reached || !!going}
          title={reached ? `다음 게임: ${primary.title}` : (goal ? `목표 ${goal.toLocaleString()}점을 넘기면 열려요` : '한 판을 끝내면 열려요')}
          aria-label="다음 게임으로 이동"
          className={`h-9 pl-3 pr-2.5 rounded-full flex items-center gap-1.5 text-[12px] font-bold transition-all ${reached ? 'bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white shadow-[0_0_0_4px_rgba(37,99,235,0.25)] transport-glow' : 'bg-white/10 text-white/35 cursor-not-allowed'}`}
        >
          <span className="hidden sm:inline">다음 게임</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
