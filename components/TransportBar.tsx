'use client'
// 게임 transport — 목표 점수를 달성(또는 클리어)하면 "다음 게임으로" 이동 화살표가 활성화된다. 사람이 후보 중 골라도 된다.
// 점수는 게임이 부모로 보내는 aj:event(score/over/clear) 를 텔레메트리가 window 'aj:game-event' 로 재발행한 것을 듣는다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { rankFor, TOP_N, type Leaderboard } from '@/lib/games/leaderboard'

interface Cand { id: string; title: string; genre: string; thumbnail_url: string; coin_cost: number; reason: string }
interface Info { goal: number | null; goalSource: 'admin' | 'auto' | 'finish'; next: Cand[]; leaderboard?: Leaderboard; meId?: string | null }
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
  const [boardOpen, setBoardOpen] = useState(false)
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

  // 판정: 회원 TOP 10 진입(10위 점수 초과, 10명 미만이면 1점 이상) 또는 관리자 목표 점수 달성 → 이동 가능. 순위표가 없는 환경이면 한 판 끝내기.
  const lb = info?.leaderboard
  const myRank = lb ? rankFor(lb, score, info?.meId) : 0
  useEffect(() => {
    if (!info) return
    const ok = (lb ? myRank > 0 : finished) || (info.goalSource === 'admin' && !!info.goal && score >= info.goal)
    if (!ok || reached) return
    const t = setTimeout(() => { setReached(true); reachedAt.current = Date.now(); setPickOpen(true) }, 0)
    return () => clearTimeout(t)
  }, [info, lb, myRank, score, finished, reached])

  const go = useCallback(async (c: Cand, picked: boolean) => {
    if (going) return
    setGoing(c.id)
    try { sessionStorage.setItem(CHAIN_KEY, String(readChain() + 1)) } catch { /* */ }
    try { await fetch(`/api/games/${gameId}/transport`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: c.id, score, goal: info?.goal ?? null, picked }), keepalive: true }) } catch { /* */ }
    router.push(`/games/${c.id}?play=1`)
  }, [gameId, going, info, router, score])

  if (!active || !info || info.next.length === 0) return null
  // 진입 기준 점수: 10명이 차 있으면 10위 점수 + 1, 아니면 1점. 관리자 목표가 더 낮으면 그쪽.
  const need = lb ? (lb.full && lb.threshold != null ? lb.threshold + 1 : 1) : null
  const goal = need != null ? (info.goalSource === 'admin' && info.goal ? Math.min(info.goal, need) : need) : info.goal
  const pct = goal ? Math.min(100, Math.round((score / goal) * 100)) : (finished ? 100 : 0)
  const primary = info.next[0]
  const rows = (() => {
    if (!lb) return []
    const others = lb.top.filter(r => r.user_id !== info.meId)
    const mine = score > 0 ? [{ user_id: info.meId ?? '_me', username: '나', agent_name: null, best: score, achieved_at: '', me: true }] : []
    return [...others.map(r => ({ ...r, me: false })), ...mine].sort((a, b) => b.best - a.best).slice(0, TOP_N)
  })()

  return (
    <div className="pointer-events-none absolute right-3 top-[60px] z-30 flex flex-col items-end gap-2 max-w-[min(92vw,20rem)]">
      {/* 회원 TOP 10 — 이 안에 들면 transport 활성 */}
      {boardOpen && lb && (
        <div className="pointer-events-auto w-72 rounded-2xl bg-[#0f1219]/92 backdrop-blur-md border border-white/12 shadow-[0_14px_40px_rgba(0,0,0,0.55)] p-3 transport-pop">
          <div className="flex items-center justify-between mb-1.5"><p className="text-white text-[12.5px] font-bold">🏆 회원 TOP {TOP_N}</p><span className="text-white/55 text-[10.5px]">{lb.full && lb.threshold != null ? `${(lb.threshold + 1).toLocaleString()}점부터 진입` : '지금 들어가면 바로 순위권'}</span></div>
          {rows.length === 0 ? <p className="text-white/55 text-[11.5px] py-2">아직 기록이 없어요. 첫 1위가 되어 보세요!</p> : (
            <ol className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={r.user_id + i} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[11.5px] ${r.me ? 'bg-[#2563eb]/35 text-white font-bold' : 'text-white/85'}`}>
                  <span className={`w-5 text-center tabular-nums ${i < 3 ? 'text-[#fbbf24] font-bold' : 'text-white/50'}`}>{i + 1}</span>
                  <span className="flex-1 truncate">{r.me ? '나 (진행 중)' : (r.agent_name || r.username)}</span>
                  <span className="tabular-nums">{r.best.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {/* 후보 선택 카드 — 목표 달성 시 자동으로 펼쳐지고, 사람이 골라도 된다 */}
      {pickOpen && reached && (
        <div className="pointer-events-auto w-72 rounded-2xl bg-[#0f1219]/92 backdrop-blur-md border border-white/12 shadow-[0_14px_40px_rgba(0,0,0,0.55)] p-3 transport-pop">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-[12px] font-bold">{myRank > 0 ? `🏆 TOP 10 진입 (${myRank}위)! 다음 게임은?` : '🎯 목표 달성! 다음 게임은?'}</p>
            <button onClick={() => setPickOpen(false)} className="text-white/60 hover:text-white text-[12px]">나중에</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {info.next.map((c, i) => (
              <button key={c.id} onClick={() => go(c, i !== 0)} disabled={!!going} className={`group relative flex items-center gap-2 rounded-xl overflow-hidden border p-1 text-left transition-colors hover:bg-white/10 disabled:opacity-60 ${i === 0 ? 'border-[#60a5fa] bg-[#2563eb]/15' : 'border-white/12'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail_url} alt={c.title} className="w-16 h-10 rounded-md object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[11.5px] font-semibold truncate">{c.title}</p>
                  <p className="text-white/55 text-[10px] truncate">{i === 0 ? '추천 · ' : ''}{c.reason}{c.coin_cost > 1 ? ` · 🪙${c.coin_cost}` : ''}</p>
                </div>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/60 shrink-0 mr-1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                {going === c.id && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[12px]">이동 중…</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 진행 바 + 이동 화살표 */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md border border-white/12 pl-3 pr-1.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
        {chain > 0 && <span className="text-[10.5px] font-bold text-[#fbbf24] whitespace-nowrap">🚀 {chain}연속</span>}
        <div className="flex flex-col min-w-[96px]">
          <div className="flex items-baseline justify-between gap-2 text-[10.5px] text-white/80 leading-none mb-1">
            <span>{reached && myRank > 0 ? `🏆 ${myRank}위 진입` : goal ? (lb ? `TOP10 진입 ${goal.toLocaleString()}` : `목표 ${goal.toLocaleString()}`) : '한 판 끝내기'}</span>
            <span className="tabular-nums font-semibold text-white">{goal ? score.toLocaleString() : (finished ? '완료' : '진행 중')}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden"><div className={`h-full rounded-full transition-[width] duration-500 ${reached ? 'bg-[#22c55e]' : 'bg-[#60a5fa]'}`} style={{ width: `${pct}%` }} /></div>
        </div>
        {lb && <button onClick={() => setBoardOpen(v => !v)} title="회원 TOP 10" aria-label="순위표" className={`h-9 w-9 rounded-full flex items-center justify-center text-[15px] transition-colors ${boardOpen ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>🏆</button>}
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
