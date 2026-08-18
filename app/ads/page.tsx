'use client'
// AJ AdPilot — AJ에게 홍보 맡기기: 캠페인(의뢰) 만들기 · 예산(코인) · 성과(노출/클릭/플레이/획득 코인/ROAS)
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { titleFont } from '@/lib/fonts'
import { GameCoinBadge } from '@/components/CurrencyBadge'

interface Campaign { id: string; game_id: string; title: string | null; creative: { headline?: string; hook?: string; badge?: string; by?: string; fun_score?: number | null }; budget_coins: number; spent_coins: number; cpc_coins: number; status: string; targeting: { genres?: string[]; countries?: string[] }; auto: boolean; impressions: number; clicks: number; plays: number; coins_earned: number; created_at: string; games: { id: string; title: string; thumbnail_url: string; genre: string } | null }

const GENRES = ['action', 'adventure', 'strategy', 'sports']
const STATUS: Record<string, [string, string]> = { active: ['진행 중', 'bg-emerald-50 text-emerald-600'], paused: ['일시정지', 'bg-amber-50 text-amber-600'], done: ['종료', 'bg-[#f1ece2] text-[#6b6152]'], rejected: ['반려', 'bg-rose-50 text-rose-600'] }
const input = 'w-full h-10 rounded-lg border border-[#ddd3bf] bg-white px-3.5 text-[14px] text-[#241f17] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition'
const label = 'block text-[12px] font-semibold text-[#6b6152] mb-1.5'

function AdsInner() {
  const sp = useSearchParams()
  const supabase = createClient()
  const [me, setMe] = useState<string | null>(null)
  const [vcoin, setVcoin] = useState(0)
  const [camps, setCamps] = useState<Campaign[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [myGames, setMyGames] = useState<Game[]>([])
  const [q, setQ] = useState(''); const [found, setFound] = useState<Game[]>([])
  const [open, setOpen] = useState(!!sp.get('game'))
  const [gameId, setGameId] = useState(sp.get('game') ?? '')
  const [gameTitle, setGameTitle] = useState('')
  const [budget, setBudget] = useState(50); const [cpc, setCpc] = useState(1)
  const [headline, setHeadline] = useState(''); const [hook, setHook] = useState(''); const [badge, setBadge] = useState('AJ PICK')
  const [genres, setGenres] = useState<string[]>([]); const [auto, setAuto] = useState(true)
  const [ajNote, setAjNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600) }

  const load = useCallback(async () => {
    const r = await fetch('/api/ads/campaigns'); const j = await r.json()
    if (!r.ok) { if (j.missing) setMissing(true); setCamps([]); return }
    setCamps(j.campaigns); setVcoin(j.vcoin)
  }, [])
  useEffect(() => {
    const t0 = setTimeout(() => supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login?redirect=/ads'; return }
      setMe(user.id)
      supabase.from('profiles').select('vcoin').eq('id', user.id).maybeSingle().then(({ data }) => setVcoin((data as { vcoin?: number } | null)?.vcoin ?? 0))
      const { data } = await supabase.from('games').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setMyGames((data as Game[] | null) ?? [])
      load()
    }), 0)
    return () => clearTimeout(t0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!q.trim()) { const t = setTimeout(() => setFound([]), 0); return () => clearTimeout(t) }
    const t = setTimeout(async () => { const { data } = await supabase.from('games').select('*').ilike('title', `%${q.trim()}%`).limit(8); setFound((data as Game[] | null) ?? []) }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // 게임 선택 시 AJ 크리에이티브 자동 생성
  const pickGame = async (g: { id: string; title: string }) => {
    setGameId(g.id); setGameTitle(g.title); setQ(''); setFound([]); setAjNote('AJ가 문구를 만드는 중…')
    const r = await fetch('/api/ads/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.id }) })
    if (r.ok) { const j = await r.json(); setHeadline(j.creative.headline ?? g.title); setHook(j.creative.hook ?? ''); setBadge(j.creative.badge ?? 'AJ PICK'); setBudget(j.suggestedBudget); setCpc(j.suggestedCpc); setAjNote(`${j.ajName}의 제안: 최근 7일 코인 ${j.weekCoins} → 권장 예산 ${j.suggestedBudget}코인 (수익의 20% 재투자), 클릭당 ${j.suggestedCpc}코인`) }
    else setAjNote(null)
  }
  useEffect(() => { const gid = sp.get('game'); if (!gid || gameTitle) return; const g = myGames.find(x => x.id === gid); if (!g) return; const t = setTimeout(() => pickGame(g), 0); return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGames])

  const create = async () => {
    if (!gameId) { setErr('게임을 선택하세요.'); return }
    setBusy(true); setErr(null)
    const r = await fetch('/api/ads/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, budget, cpc, title: headline, creative: { headline, hook, badge, by: 'aj' }, targeting: { genres }, auto }) })
    const j = await r.json(); setBusy(false)
    if (!r.ok) { setErr(j.error ?? '실패'); if (j.missing) setMissing(true); return }
    say('캠페인을 시작했어요. AJ가 피드에서 홍보를 시작합니다.'); setOpen(false); setGameId(''); setGameTitle(''); load()
  }
  const act = async (id: string, action: string, coins?: number) => {
    setBusy(true)
    const r = await fetch('/api/ads/campaigns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, coins }) })
    const j = await r.json(); setBusy(false)
    if (!r.ok) { say(j.error ?? '실패'); return }
    say(action === 'close' ? `종료했어요. 남은 ${j.refunded}코인을 돌려받았어요.` : action === 'fund' ? '예산을 충전했어요.' : '변경했어요.'); load()
  }
  const totals = useMemo(() => (camps ?? []).reduce((a, c) => ({ spent: a.spent + c.spent_coins, clicks: a.clicks + c.clicks, plays: a.plays + c.plays, earned: a.earned + c.coins_earned, imps: a.imps + c.impressions }), { spent: 0, clicks: 0, plays: 0, earned: 0, imps: 0 }), [camps])
  const roas = totals.spent ? (totals.earned / totals.spent) : 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="font-pixel text-[11px] tracking-[0.3em] text-[#2563eb]">AJ ADPILOT</p>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`${titleFont.className} text-[32px] md:text-[40px] leading-tight text-[#241f17]`}>AJ에게 홍보를 맡기세요</h1>
          <p className="mt-2 text-[13px] text-[#6b6152] max-w-2xl">AJ가 게임의 지표(재미 점수·체류·수익)로 광고 문구를 만들고, 홈·게임 피드에 <b>AJ PICK</b> 카드로 노출해요. 코인으로 예산을 걸면 클릭당 과금되고, 유입된 플레이가 벌어들인 코인까지 추적합니다. 내 게임뿐 아니라 다른 게임 홍보 <b>의뢰</b>도 가능해요.</p>
        </div>
        <div className="flex items-center gap-3">
          <GameCoinBadge amount={vcoin} />
          <button onClick={() => setOpen(true)} className="h-10 px-5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[13px] font-bold shadow-[0_6px_18px_rgba(37,99,235,0.3)]">캠페인 만들기</button>
        </div>
      </div>

      {missing && <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">광고 테이블이 아직 없어요. 관리자가 <code>db/migrations/2026-08-18-ads.sql</code> 을 실행하면 사용할 수 있어요.</p>}

      {/* 성과 요약 */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
        {[['노출', totals.imps], ['클릭', totals.clicks], ['플레이 전환', totals.plays], ['사용 코인', totals.spent], ['ROAS', `${roas.toFixed(1)}×`]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-[#ebe4d6] bg-white p-4"><p className="text-[11.5px] text-[#857a68]">{l}</p><p className="text-[22px] font-extrabold text-[#241f17] tracking-tight">{typeof v === 'number' ? v.toLocaleString() : v}</p></div>
        ))}
      </div>

      {/* 캠페인 목록 */}
      <div className="mt-6 space-y-3">
        {camps === null ? <p className="text-[13px] text-[#9d9280]">불러오는 중…</p> : camps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3bf] bg-white/60 p-10 text-center">
            <p className="text-[15px] font-bold text-[#241f17]">아직 캠페인이 없어요</p>
            <p className="text-[12.5px] text-[#857a68] mt-1">게임을 고르면 AJ가 문구·예산을 제안해요. 최소 10코인부터.</p>
            <button onClick={() => setOpen(true)} className="mt-4 h-10 px-5 rounded-lg bg-[#241f17] text-white text-[13px] font-bold">첫 캠페인 만들기</button>
          </div>
        ) : camps.map(c => {
          const ctr = c.impressions ? (c.clicks / c.impressions * 100) : 0
          const left = c.budget_coins - c.spent_coins
          const [sl, sc] = STATUS[c.status] ?? [c.status, '']
          return (
            <div key={c.id} className="rounded-2xl border border-[#ebe4d6] bg-white p-4 md:p-5">
              <div className="flex items-start gap-4">
                <span className="relative w-24 h-14 rounded-lg overflow-hidden bg-gray-900 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.games && <img src={c.games.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><p className="text-[15px] font-bold text-[#241f17] truncate">{c.creative?.headline ?? c.title ?? c.games?.title}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc}`}>{sl}</span>{c.auto && <span className="rounded-full bg-[#2563eb]/10 text-[#2563eb] px-2 py-0.5 text-[11px] font-semibold">AJ 자동</span>}</div>
                  <p className="text-[12.5px] text-[#857a68] truncate">{c.games?.title} · {c.creative?.hook}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-[#f1ece2] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4]" style={{ width: `${Math.min(100, c.budget_coins ? (c.spent_coins / c.budget_coins) * 100 : 0)}%` }} /></div>
                  <p className="text-[11.5px] text-[#9d9280] mt-1">예산 {c.spent_coins}/{c.budget_coins} 코인 · 클릭당 {c.cpc_coins} · 남은 {left}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                {[['노출', c.impressions], ['클릭', c.clicks], ['CTR', `${ctr.toFixed(1)}%`], ['플레이', c.plays], ['획득 코인', c.coins_earned], ['ROAS', c.spent_coins ? `${(c.coins_earned / c.spent_coins).toFixed(1)}×` : '-']].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-[#faf8f3] py-2"><p className="text-[10.5px] text-[#9d9280]">{l}</p><p className="text-[14px] font-bold text-[#241f17]">{typeof v === 'number' ? v.toLocaleString() : v}</p></div>
                ))}
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {c.status === 'active' && <button disabled={busy} onClick={() => act(c.id, 'pause')} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12.5px] font-medium hover:border-[#2563eb]">일시정지</button>}
                {c.status === 'paused' && <button disabled={busy} onClick={() => act(c.id, 'resume')} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12.5px] font-medium hover:border-[#2563eb]">재개</button>}
                {c.status !== 'done' && <button disabled={busy} onClick={() => { const v = prompt('추가할 코인 수'); const n = Number(v); if (n > 0) act(c.id, 'fund', n) }} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12.5px] font-medium hover:border-[#2563eb]">예산 충전</button>}
                {c.status !== 'done' && <button disabled={busy} onClick={() => { if (confirm('캠페인을 종료하고 남은 예산을 돌려받을까요?')) act(c.id, 'close') }} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12.5px] font-medium text-[#857a68] hover:border-[#e11d48] hover:text-[#e11d48]">종료 · 환급</button>}
                {c.games && <Link href={`/aj/${c.games.id}`} className="h-8 px-3 rounded-lg border border-[#ddd3bf] text-[12.5px] font-medium hover:border-[#2563eb] inline-flex items-center">AJ 대시보드</Link>}
              </div>
            </div>
          )
        })}
      </div>

      {/* 캠페인 만들기 */}
      {open && (
        <div className="fixed inset-0 z-[80] bg-[#241f17]/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#ebe4d6] flex items-center justify-between"><h2 className="text-[15px] font-bold">캠페인 만들기 · AJ에게 의뢰</h2><button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#f4efe6]">✕</button></div>
            <div className="p-5 space-y-4">
              <div>
                <label className={label}>홍보할 게임</label>
                {gameId ? <div className="flex items-center justify-between rounded-lg border border-[#2563eb] bg-[#2563eb]/5 px-3 h-10 text-[14px]"><span className="font-semibold text-[#241f17] truncate">{gameTitle}</span><button onClick={() => { setGameId(''); setGameTitle('') }} className="text-[12px] text-[#2563eb]">변경</button></div> : (
                  <>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="게임 검색 (내 게임 / 다른 게임 의뢰)" className={input} autoFocus />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(found.length ? found : myGames.slice(0, 8)).map(g => <button key={g.id} onClick={() => pickGame(g)} className="rounded-full border border-[#ddd3bf] px-3 h-8 text-[12.5px] hover:border-[#2563eb] hover:text-[#2563eb] max-w-[220px] truncate">{g.title}{g.user_id === me ? '' : ' · 의뢰'}</button>)}
                    </div>
                  </>
                )}
              </div>
              {ajNote && <p className="rounded-lg bg-[#2563eb]/5 text-[#2563eb] text-[12.5px] px-3 py-2">{ajNote}</p>}
              <div><label className={label}>헤드라인 (AJ 제안 — 수정 가능)</label><input value={headline} onChange={e => setHeadline(e.target.value)} className={input} /></div>
              <div><label className={label}>한 줄 훅</label><input value={hook} onChange={e => setHook(e.target.value)} className={input} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={label}>배지</label><input value={badge} onChange={e => setBadge(e.target.value)} className={input} /></div>
                <div><label className={label}>예산 (코인)</label><input type="number" min={10} value={budget} onChange={e => setBudget(Number(e.target.value))} className={input} /></div>
                <div><label className={label}>클릭당 (코인)</label><input type="number" min={1} value={cpc} onChange={e => setCpc(Number(e.target.value))} className={input} /></div>
              </div>
              <div><label className={label}>타게팅 장르 (선택)</label><div className="flex gap-1.5 flex-wrap">{GENRES.map(g => <button key={g} onClick={() => setGenres(genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g])} className={`h-8 px-3 rounded-full text-[12px] font-semibold border ${genres.includes(g) ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]' : 'border-[#ddd3bf] text-[#6b6152]'}`}>{g.toUpperCase()}</button>)}</div></div>
              <label className="flex items-center gap-2 text-[13px] text-[#4a4337]"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-[#2563eb]" />AJ 자동 운영 — 성과 보고 문구·입찰을 AJ가 조정 (리포트에 반영)</label>
              <p className="text-[11.5px] text-[#9d9280]">예산은 지금 코인에서 차감돼요 (보유 {vcoin.toLocaleString()}). 클릭당 {cpc}코인이 소진되고, 예산이 다 쓰이면 자동 종료. 언제든 종료하면 남은 예산은 돌려받아요. 예상 클릭 약 {Math.floor(budget / Math.max(1, cpc))}회.</p>
              {err && <p className="text-[13px] text-red-500">{err}</p>}
              <button onClick={create} disabled={busy || !gameId || budget < 10 || budget > vcoin} className="w-full h-11 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[14px] font-bold disabled:opacity-40">{budget > vcoin ? '코인이 부족해요' : `${budget}코인으로 캠페인 시작`}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-full bg-[#241f17] text-white px-4 py-2 text-[13px] font-semibold shadow-lg">{toast}</div>}
    </div>
  )
}

export default function AdsPage() { return <Suspense fallback={null}><AdsInner /></Suspense> }
