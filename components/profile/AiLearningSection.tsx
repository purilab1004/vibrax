'use client'
// 내정보 > AJ 학습 — 뉴로에볼루션 대시보드. 게임을 골라 그 게임 AI 의 학습 현황·세대별 성적·최고 개체(정책 신경망)·학습 기록을 본다.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Curriculum { total: number; learned: number; steps: { name: string; done: boolean }[]; next: string | null; needEpisodes: number; readyAt: string | null }
interface Rule { cond: string; action: string; hold?: number; why?: string }
interface Episode { v: number; score: number; sec: number; cleared: boolean; t: string }
interface BrainViz { arch: [number, number, number]; inputs: string[]; outputs: string[]; w1: number[][]; w2: number[][]; gen: number; fitness: number; history: { gen: number; best: number; avg: number }[] }
interface Row {
  game_id: string; version: number; rules: Rule[]; params: Record<string, number> | null; brainViz?: BrainViz | null
  best_score: number | null; best_score_at?: string | null; auto_learn?: boolean; auto_count?: number
  template_skill?: number; episodes?: Episode[]; demos?: unknown[]; updated_at: string
  curriculum?: Curriculum | null; games: { title: string; genre: string; thumbnail_url: string | null } | null
}
const IN_LABEL: Record<string, string> = { ballX: '공 X', ballY: '공 Y', ballDx: '공 속도X', ballDy: '공 속도Y', paddleX: '패들 X', paddleW: '패들폭', score: '점수', lives: '목숨', stage: '스테이지', bricksLeft: '남은 벽돌', px: '조각 X', prot: '회전', ptype: '조각', level: '레벨', lines: '라인', maxH: '높이', holes: '구멍', bump: '요철', attached: '붙음' }
const OUT_LABEL: Record<string, string> = { left: '◀ 왼쪽', right: '▶ 오른쪽', up: '▲ 위', down: '▼ 아래', action: '● 액션', action2: '○ 액션2' }
interface LearnLog { id: string; game_id: string | null; kind: string; title: string; detail: string | null; version: number | null; created_at: string }
const LOG_KIND: Record<string, [string, string]> = { record: ['최고 점수', '#e11d48'], curriculum: ['기본기', '#2563eb'], coach: ['프롬프트 코칭', '#7c3aed'], demo: ['내 플레이 모방', '#0891b2'], reflect: ['자기 반성', '#059669'], revert: ['복귀', '#f59e0b'], play: ['AI 플레이', '#0ea5e9'], guide: ['개발자 가이드', '#d97706'] }
const GENRE: Record<string, { label: string; color: string }> = {
  action: { label: 'ACTION', color: '#dc2626' }, sports: { label: 'SPORTS', color: '#059669' },
  adventure: { label: 'ADVENTURE', color: '#d97706' }, strategy: { label: 'STRATEGY', color: '#2563eb' },
}
// 리워드 뱃지 — 누적 XP 20단계
const TIERS = ['새싹', '견습', '초보', '연습생', '루키', '플레이어', '도전자', '숙련', '베테랑', '프로', '에이스', '엘리트', '마스터', '그랜드마스터', '챔피언', '전설', '신화', '오라클', '초월', '비브렉스'] as const
const TIER_COLORS = ['#9ca3af', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#fbbf24', '#fde047', '#facc15']
const tierNeed = (i: number) => Math.round(60 * Math.pow(1.28, i))
const tierOf = (xp: number) => { let t = 0, acc = 0; while (t < TIERS.length - 1 && xp >= acc + tierNeed(t)) { acc += tierNeed(t); t++ } return { tier: t, into: xp - acc, need: tierNeed(t), maxed: t === TIERS.length - 1 } }
const xpOf = (r: Row) => r.version * 10 + (Array.isArray(r.rules) ? r.rules.length : 0) * 6 + (r.template_skill ?? 0) * 15 + (r.best_score && r.best_score > 0 ? 12 : 0)
const fmtDT = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AiLearningSection() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [logs, setLogs] = useState<LearnLog[]>([])
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    fetch('/api/ai-bj/learning').then(r => r.json())
      .then(j => { if (j.error) { setMissing(true); setRows([]) } else { const rs = (j.rows as Row[]) ?? []; setRows(rs); setSel(s => s ?? rs[0]?.game_id ?? null) } })
      .catch(() => { setMissing(true); setRows([]) })
    createClient().from('aj_learn_log').select('*').order('created_at', { ascending: false }).limit(400).then(({ data }) => setLogs((data as LearnLog[] | null) ?? []))
  }, [])

  const totalXp = useMemo(() => (rows ?? []).reduce((a, r) => a + xpOf(r), 0), [rows])
  const allAuto = !rows || rows.length === 0 || rows.every(r => r.auto_learn !== false)
  const toggleAuto = async (on: boolean) => { setRows(rs => (rs ?? []).map(r => ({ ...r, auto_learn: on }))); await createClient().from('aj_play_policies').update({ auto_learn: on } as never).in('game_id', (rows ?? []).map(r => r.game_id)) }
  const learnFromDemo = async (gameId: string) => { setBusy(gameId); try { const r = await fetch('/api/ai-bj/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'learnFromDemo', gameId }) }); const j = await r.json(); if (r.ok && j.policy) setRows(rs => (rs ?? []).map(x => x.game_id === gameId ? { ...x, version: j.policy.version, rules: j.policy.rules } : x)); else alert(j.error ?? '실패') } finally { setBusy(null) } }

  if (rows === null) return <div className="h-40 rounded-2xl bg-[#f6f2ea] animate-pulse" />
  const cur = rows.find(r => r.game_id === sel) ?? null
  const t = tierOf(totalXp)

  return (
    <div className="space-y-4">
      {/* 헤더 — 타이틀 + 리워드 뱃지 + 자동학습 */}
      <div className="rounded-2xl bg-[#0f1420] text-white p-4 md:p-5 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
        <div className="relative flex items-center gap-4 flex-wrap">
          <TierBadge tier={t.tier} size={54} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.25em] text-white/50 uppercase">Neuro-Evolution · Reward {t.tier + 1}/20</p>
            <p className="text-[18px] font-extrabold leading-tight">{TIERS[t.tier]} <span className="text-[12px] font-semibold text-white/50">· 누적 {totalXp} XP · 학습 게임 {rows.length}</span></p>
            {!t.maxed && <div className="mt-1.5 h-1.5 max-w-[320px] rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round(t.into / t.need * 100)}%`, background: TIER_COLORS[t.tier] }} /></div>}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-white/80 cursor-pointer shrink-0">
            <input type="checkbox" checked={allAuto} onChange={e => toggleAuto(e.target.checked)} className="accent-[#22d3ee]" />자동 학습
          </label>
        </div>
      </div>

      {missing && <p className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">학습 테이블이 아직 준비되지 않았어요. <code>db/migrations/2026-08-21-curriculum-log.sql</code> 을 실행하세요.</p>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e6dfd0] bg-white p-10 text-center">
          <p className="text-[15px] font-bold text-[#241f17]">아직 학습한 게임이 없어요</p>
          <p className="text-[12.5px] text-[#857a68] mt-1">게임을 열고 <b>게임 참여</b>로 AI 를 플레이시키거나 직접 플레이하면 학습이 시작돼요. <Link href="/games" className="text-[#2563eb] font-semibold">게임 보러 가기 →</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
          {/* 게임 목록 — 검색 + 스크롤 리스트 (모바일은 드롭다운) */}
          <aside className="lg:sticky lg:top-4 self-start">
            {/* 모바일: 드롭다운 */}
            <select value={sel ?? ''} onChange={e => setSel(e.target.value)} className="lg:hidden w-full h-11 rounded-xl border border-[#e6dfd0] bg-white px-3 text-[13.5px] font-semibold text-[#241f17] mb-3">
              {rows.map(r => <option key={r.game_id} value={r.game_id}>{r.games?.title ?? '게임'} · v{r.version}{r.best_score != null ? ` · ${r.best_score}점` : ''}</option>)}
            </select>
            {/* 데스크톱: 검색 + 목록 */}
            <div className="hidden lg:block rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] overflow-hidden">
              <div className="p-2.5 border-b border-[#f1ece2]">
                <div className="flex items-center gap-2 h-9 rounded-lg bg-[#f6f2ea] px-2.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9d9280] shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="게임 검색" className="flex-1 min-w-0 bg-transparent text-[13px] focus:outline-none" />
                </div>
              </div>
              <ul className="max-h-[520px] overflow-y-auto p-1.5">
                {rows.filter(r => !q.trim() || (r.games?.title ?? '').toLowerCase().includes(q.trim().toLowerCase())).map(r => (
                  <li key={r.game_id}>
                    <button onClick={() => setSel(r.game_id)} className={`w-full flex items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors ${sel === r.game_id ? 'bg-[#241f17] text-white' : 'hover:bg-[#f6f2ea]'}`}>
                      <span className="w-9 h-9 rounded-lg overflow-hidden bg-[#f1ece2] shrink-0">{r.games?.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.games.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : null}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold truncate">{r.games?.title ?? '게임'}</span>
                        <span className={`block text-[10.5px] tabular-nums ${sel === r.game_id ? 'text-white/60' : 'text-[#9d9280]'}`}>v{r.version}{r.best_score != null ? ` · 🏆${r.best_score}` : ''}{(r.template_skill ?? 0) > 0 ? ` · 기본기${r.template_skill}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {rows.filter(r => !q.trim() || (r.games?.title ?? '').toLowerCase().includes(q.trim().toLowerCase())).length === 0 && <li className="p-4 text-center text-[12px] text-[#9d9280]">검색 결과 없음</li>}
              </ul>
            </div>
          </aside>

          <div className="min-w-0">{cur && <GameDashboard row={cur} logs={logs.filter(l => l.game_id === cur.game_id)} busy={busy === cur.game_id} onLearnDemo={() => learnFromDemo(cur.game_id)} />}</div>
        </div>
      )}
    </div>
  )
}

function GameDashboard({ row, logs, busy, onLearnDemo }: { row: Row; logs: LearnLog[]; busy: boolean; onLearnDemo: () => void }) {
  const eps = Array.isArray(row.episodes) ? row.episodes : []
  const rules = Array.isArray(row.rules) ? row.rules : []
  const g = GENRE[row.games?.genre ?? 'action'] ?? GENRE.action
  const demoN = Array.isArray(row.demos) ? row.demos.length : 0
  const clears = eps.filter(e => e.cleared).length
  return (
    <div className="space-y-3">
      {/* 학습 현황 — 스탯 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="세대(버전)" value={`v${row.version}`} accent={g.color} />
        <Stat label="최고 점수" value={row.best_score != null ? row.best_score.toLocaleString() : '—'} sub={row.best_score_at ? fmtDT(row.best_score_at) : undefined} accent="#e11d48" />
        <Stat label="플레이 판수" value={eps.length} sub={clears > 0 ? `클리어 ${clears}` : undefined} accent="#0ea5e9" />
        <Stat label="학습 규칙" value={rules.length} accent="#7c3aed" />
        <Stat label="기본기" value={row.curriculum ? `${row.curriculum.learned}/${row.curriculum.total}` : '—'} accent="#2563eb" />
        <Stat label="자기 진화" value={row.auto_count ?? 0} sub={demoN ? `내 플레이 ${demoN}` : undefined} accent="#059669" />
      </div>

      {/* 아바타 두뇌 — 최고 개체 신경망 (발달한 신경 줄기가 빛으로 흐른다) */}
      <div className="rounded-2xl bg-[#0b0f1a] text-white p-4 md:p-5 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.5]" style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(56,189,248,0.10), transparent 60%)' }} />
        <div className="relative flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/60">아바타 두뇌 · 신경망</p>
          {row.brainViz && <span className="text-[11px] font-semibold text-[#38bdf8] tabular-nums">{row.brainViz.gen}세대 · 적합도 {Math.round(row.brainViz.fitness)}</span>}
        </div>
        {row.brainViz ? <BrainNetwork b={row.brainViz} /> : <ParamGenome params={row.params ?? {}} rules={rules} />}
      </div>

      {/* 세대별 성적 */}
      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#857a68] mb-2">세대별 성적</p>
        {row.brainViz && row.brainViz.history.length >= 2 ? <GenerationHistory history={row.brainViz.history} /> : <GenerationChart episodes={eps} />}
      </div>

      {/* 기본기 진행 */}
      {row.curriculum && (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4">
          <div className="flex items-center justify-between mb-2"><p className="text-[12px] font-bold uppercase tracking-wide text-[#857a68]">기본기 커리큘럼</p><span className="text-[12px] font-bold text-[#2563eb]">{row.curriculum.learned}/{row.curriculum.total}</span></div>
          <div className="h-2 rounded-full bg-[#f1ece2] overflow-hidden mb-2"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${row.curriculum.total ? Math.round(row.curriculum.learned / row.curriculum.total * 100) : 0}%` }} /></div>
          <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {row.curriculum.steps.map((st, i) => <li key={i} className={`text-[12px] flex items-center gap-1.5 ${st.done ? 'text-[#059669]' : 'text-[#9d9280]'}`}><span>{st.done ? '✓' : '○'}</span>{i + 1}. {st.name}{!st.done && i === row.curriculum!.learned && <span className="text-[#2563eb] font-semibold text-[11px]">← 다음{row.curriculum!.needEpisodes > 0 ? ` (${row.curriculum!.needEpisodes}판 더)` : row.curriculum!.readyAt && new Date(row.curriculum!.readyAt) > new Date() ? ` (${new Date(row.curriculum!.readyAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 이후)` : ''}</span>}</li>)}
          </ol>
        </div>
      )}

      {/* 학습 기록 */}
      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#857a68]">학습 기록</p>
          {demoN >= 20 && <button onClick={onLearnDemo} disabled={busy} className="h-7 px-3 rounded-full bg-[#241f17] text-white text-[11px] font-bold disabled:opacity-50">{busy ? '학습 중…' : '내 플레이로 학습'}</button>}
        </div>
        {logs.length === 0 ? <p className="text-[12.5px] text-[#9d9280] py-6 text-center">이 게임의 학습 기록이 아직 없어요.</p> : (
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {logs.map(l => { const [lb, c] = LOG_KIND[l.kind] ?? [l.kind, '#6b7280']; return (
              <li key={l.id} className="flex items-start gap-2 text-[12px]">
                <span className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap" style={{ background: c }}>{lb}</span>
                <span className="min-w-0 flex-1 text-[#374151]"><b className="text-[#241f17]">{l.title}</b>{l.detail ? <span className="block text-[11px] text-[#9d9280] truncate">{l.detail}</span> : null}</span>
                <span className="shrink-0 text-[10.5px] text-[#9d9280] tabular-nums">{fmtDT(l.created_at)}{l.version ? ` · v${l.version}` : ''}</span>
              </li>) })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_8px_24px_-18px_rgba(36,31,23,0.25)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa1ad]">{label}</p>
      <p className="text-[19px] font-extrabold leading-none mt-1 tabular-nums truncate" style={{ color: accent ?? '#1f2430' }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9d9280] mt-1 truncate">{sub}</p>}
    </div>
  )
}

// 세대별 성적 — 판마다 점수(점), 지금까지 최고점(계단선). 세대(버전) 경계는 배경 밴드.
function GenerationChart({ episodes }: { episodes: Episode[] }) {
  if (episodes.length < 2) return <div className="h-40 flex items-center justify-center text-[12.5px] text-[#9d9280]">판을 2번 이상 플레이하면 성적 그래프가 나와요.</div>
  const W = 560, H = 160, pad = { l: 34, r: 8, t: 10, b: 18 }
  const n = episodes.length
  const maxS = Math.max(1, ...episodes.map(e => e.score))
  const x = (i: number) => pad.l + (n === 1 ? 0 : i / (n - 1) * (W - pad.l - pad.r))
  const y = (s: number) => pad.t + (1 - s / maxS) * (H - pad.t - pad.b)
  // best-so-far 계단선
  const bestPts: (readonly [number, number])[] = []; let bAcc = 0; for (let i = 0; i < episodes.length; i++) { bAcc = Math.max(bAcc, episodes[i].score); bestPts.push([x(i), y(bAcc)] as const) }
  const bestPath = bestPts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  // 세대(버전) 색
  const versions = Array.from(new Set(episodes.map(e => e.v)))
  const vColor = (v: number) => TIER_COLORS[versions.indexOf(v) % TIER_COLORS.length]
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" style={{ height: 176 }}>
      {[0, 0.5, 1].map(f => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(maxS * f)} y2={y(maxS * f)} stroke="#eef0f4" /><text x={4} y={y(maxS * f) + 3} fontSize="9" fill="#9aa1ad">{Math.round(maxS * f)}</text></g>)}
      <path d={bestPath} fill="none" stroke="#e11d48" strokeWidth="2" strokeDasharray="1 0" opacity="0.9" />
      {episodes.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.score)} r={e.cleared ? 4 : 2.6} fill={vColor(e.v)} stroke={e.cleared ? '#fff' : 'none'} strokeWidth="1.2"><title>{`판 ${i + 1} · v${e.v} · ${e.score}점${e.cleared ? ' · 클리어' : ''}`}</title></circle>)}
      <text x={pad.l} y={H - 4} fontSize="9" fill="#9aa1ad">1판</text>
      <text x={W - pad.r} y={H - 4} fontSize="9" fill="#9aa1ad" textAnchor="end">{n}판</text>
    </svg>
    <div className="flex items-center gap-3 mt-1 text-[10.5px] text-[#9d9280] flex-wrap">
      <span className="inline-flex items-center gap-1"><span className="w-4 h-0.5 bg-[#e11d48] inline-block" />최고 기록</span>
      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full ring-2 ring-white inline-block" style={{ background: '#0ea5e9' }} />클리어</span>
      <span>점 색 = 세대(버전)</span>
    </div>
    </div>
  )
}

// 최고 개체 정책 신경망 — 상태특징(입력) → 규칙(은닉) → 행동(출력) 3층 그래프. 규칙이 없으면 파라미터 게놈 게이지.
// 아바타 두뇌 — 실제 가중치 신경망. 초록=양·빨강=음, 굵기/불투명도=가중치 크기.
// 발달한(강한) 신경 줄기에는 빛이 흐른다(애니메이션). 입력=상태, 은닉, 출력=행동.
function BrainNetwork({ b }: { b: BrainViz }) {
  const [ni, nh, no] = b.arch
  const W = 620, H = Math.max(170, Math.max(ni, nh, no) * 30 + 40)
  const colX = [96, W / 2, W - 96]
  const yOf = (i: number, c: number) => 30 + (c <= 1 ? (H - 60) / 2 : i / (c - 1) * (H - 60))
  const maxW = Math.max(0.001, ...b.w1.flat().map(Math.abs), ...b.w2.flat().map(Math.abs))
  const edge = (w: number) => { const a = Math.abs(w) / maxW; return { color: w >= 0 ? '#22c55e' : '#f43f5e', op: 0.12 + a * 0.7, sw: 0.4 + a * 2.4, strong: a > 0.55 } }
  // 발달한 줄기(상위 가중치)에 빛 흐름
  type E = { x1: number; y1: number; x2: number; y2: number; a: number; color: string }
  const flows: E[] = []
  b.w1.forEach((row, i) => row.forEach((w, j) => { const a = Math.abs(w) / maxW; if (a > 0.5) flows.push({ x1: colX[0], y1: yOf(i, ni), x2: colX[1], y2: yOf(j, nh), a, color: w >= 0 ? '#4ade80' : '#fb7185' }) }))
  b.w2.forEach((row, j) => row.forEach((w, k) => { const a = Math.abs(w) / maxW; if (a > 0.5) flows.push({ x1: colX[1], y1: yOf(j, nh), x2: colX[2], y2: yOf(k, no), a, color: w >= 0 ? '#4ade80' : '#fb7185' }) }))
  const topFlows = flows.sort((x, y) => y.a - x.a).slice(0, 10)
  return (
    <div className="relative">
      <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" style={{ maxHeight: 260 }}>
        <defs><filter id="nnglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {/* 층 라벨 */}
        <text x={colX[0]} y={16} fontSize="9" fill="#64748b" textAnchor="middle">상태(입력)</text>
        <text x={colX[1]} y={16} fontSize="9" fill="#64748b" textAnchor="middle">은닉 {nh}</text>
        <text x={colX[2]} y={16} fontSize="9" fill="#64748b" textAnchor="middle">행동(출력)</text>
        {/* w1 edges */}
        {b.w1.map((row, i) => row.map((w, j) => { const e = edge(w); return <line key={`a${i}-${j}`} x1={colX[0]} y1={yOf(i, ni)} x2={colX[1]} y2={yOf(j, nh)} stroke={e.color} strokeOpacity={e.op} strokeWidth={e.sw} /> }))}
        {/* w2 edges */}
        {b.w2.map((row, j) => row.map((w, k) => { const e = edge(w); return <line key={`b${j}-${k}`} x1={colX[1]} y1={yOf(j, nh)} x2={colX[2]} y2={yOf(k, no)} stroke={e.color} strokeOpacity={e.op} strokeWidth={e.sw} /> }))}
        {/* 발달한 줄기의 빛 흐름 */}
        {topFlows.map((f, i) => <line key={`f${i}`} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color} strokeWidth={1 + f.a * 2} strokeOpacity="0.9" strokeLinecap="round" strokeDasharray="1 14" filter="url(#nnglow)" className="nn-flow" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />)}
        {/* 입력 노드 */}
        {b.inputs.map((f, i) => <g key={f}><circle cx={colX[0]} cy={yOf(i, ni)} r="6" fill="#38bdf8" filter="url(#nnglow)" /><text x={colX[0] - 11} y={yOf(i, ni) + 3} fontSize="9.5" fill="#cbd5e1" textAnchor="end">{IN_LABEL[f] ?? f}</text></g>)}
        {/* 은닉 노드 */}
        {Array.from({ length: nh }).map((_, j) => <circle key={j} cx={colX[1]} cy={yOf(j, nh)} r="5.5" fill="#334155" stroke="#64748b" strokeWidth="1" />)}
        {/* 출력 노드 */}
        {b.outputs.map((a, k) => <g key={a}><circle cx={colX[2]} cy={yOf(k, no)} r="8" fill="#f472b6" filter="url(#nnglow)" /><text x={colX[2] + 12} y={yOf(k, no) + 3} fontSize="9.5" fill="#e2e8f0">{OUT_LABEL[a] ?? a}</text></g>)}
      </svg></div>
      <div className="flex items-center gap-3 mt-1 text-[10.5px] text-white/50 flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-[#22c55e] inline-block" />양(+) 가중치</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f43f5e] inline-block" />음(−) 가중치</span>
        <span>빛나는 줄기 = 발달한 신경 경로 · 선 굵기 = 가중치 크기</span>
      </div>
    </div>
  )
}

// 신경망이 아직 없는(매니페스트 없는) 게임 — 파라미터 게놈 게이지
function ParamGenome({ params, rules }: { params: Record<string, number>; rules: Rule[] }) {
  const genes: [string, number, number, number][] = [
    ['실력', params.botSkill ?? 0.3, 0, 1], ['반응속도', params.reactionMs ?? 120, 400, 30], ['무작위성', params.randomness ?? 0.15, 0.5, 0],
  ]
  return (
    <div className="space-y-2.5 py-1 relative">
      <p className="text-[11.5px] text-white/60 leading-relaxed">이 게임은 상태 정보(매니페스트)가 없어 <b className="text-white/90">신경망을 만들 수 없어요</b>. 대신 파라미터 게놈{rules.length ? '·규칙' : ''}을 진화 중이에요. 최신 표준 게임에선 진짜 신경망이 그려져요.</p>
      {genes.map(([label, v, lo, hi]) => { const pct = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return (
        <div key={label}><div className="flex justify-between text-[11px] text-white/70"><span>{label}</span><span className="tabular-nums">{v < 1 ? v.toFixed(2) : Math.round(v)}</span></div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-0.5"><div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#818cf8]" style={{ width: `${Math.round(pct * 100)}%` }} /></div></div>
      ) })}
    </div>
  )
}

// 세대별 성적 — 최고·평균 적합도의 진화(신경망 history)
function GenerationHistory({ history }: { history: { gen: number; best: number; avg: number }[] }) {
  const W = 560, H = 160, pad = { l: 34, r: 8, t: 10, b: 18 }
  const n = history.length
  const maxS = Math.max(1, ...history.map(h => h.best))
  const x = (i: number) => pad.l + (n === 1 ? 0 : i / (n - 1) * (W - pad.l - pad.r))
  const y = (s: number) => pad.t + (1 - s / maxS) * (H - pad.t - pad.b)
  const line = (key: 'best' | 'avg') => history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h[key]).toFixed(1)}`).join(' ')
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" style={{ height: 176 }}>
      {[0, 0.5, 1].map(f => <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(maxS * f)} y2={y(maxS * f)} stroke="#eef0f4" /><text x={4} y={y(maxS * f) + 3} fontSize="9" fill="#9aa1ad">{Math.round(maxS * f)}</text></g>)}
      <path d={line('avg')} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d={line('best')} fill="none" stroke="#2563eb" strokeWidth="2.4" />
      {history.map((h, i) => <circle key={i} cx={x(i)} cy={y(h.best)} r="2.6" fill="#2563eb"><title>{`${h.gen}세대 · 최고 ${Math.round(h.best)} · 평균 ${Math.round(h.avg)}`}</title></circle>)}
      <text x={pad.l} y={H - 4} fontSize="9" fill="#9aa1ad">1세대</text>
      <text x={W - pad.r} y={H - 4} fontSize="9" fill="#9aa1ad" textAnchor="end">{history[n - 1].gen}세대</text>
    </svg>
    <div className="flex items-center gap-3 mt-1 text-[10.5px] text-[#9d9280]"><span className="inline-flex items-center gap-1"><span className="w-4 h-0.5 bg-[#2563eb] inline-block" />세대 최고</span><span className="inline-flex items-center gap-1"><span className="w-4 h-0 border-t border-dashed border-[#94a3b8] inline-block" />세대 평균</span></div>
    </div>
  )
}

function TierBadge({ tier, size = 40, locked = false }: { tier: number; size?: number; locked?: boolean }) {
  const c = locked ? '#d9d2c3' : TIER_COLORS[tier]
  const stars = Math.min(5, Math.floor(tier / 4) + 1)
  const id = `tb${tier}${locked ? 'l' : ''}${size}`
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ filter: locked ? 'grayscale(1) opacity(.55)' : `drop-shadow(0 2px 6px ${c}66)` }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset=".35" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".7" /></linearGradient></defs>
      {tier >= 8 && !locked && <circle cx="32" cy="32" r="30" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="3 4" opacity=".8" />}
      <path d="M32 4l6.5 5.2 8.2-1 3.1 7.7 7.7 3.1-1 8.2L62 32l-5.5 4.8 1 8.2-7.7 3.1-3.1 7.7-8.2-1L32 60l-6.5-5.2-8.2 1-3.1-7.7-7.7-3.1 1-8.2L2 32l5.5-4.8-1-8.2 7.7-3.1 3.1-7.7 8.2 1Z" fill={`url(#${id})`} stroke={locked ? '#cfc6b4' : '#ffffffaa'} strokeWidth="1.2" />
      <circle cx="32" cy="32" r="17" fill={locked ? '#e9e3d6' : '#ffffff'} opacity=".92" />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" fill={locked ? '#b9b0a0' : c} fontFamily="-apple-system,system-ui,sans-serif">{tier + 1}</text>
      {Array.from({ length: stars }).map((_, i) => <circle key={i} cx={32 + (i - (stars - 1) / 2) * 6} cy="48" r="1.8" fill={locked ? '#c9c0ad' : c} />)}
    </svg>
  )
}
