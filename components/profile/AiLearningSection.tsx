'use client'
// 내정보 > 내 아바타·AJ — 내 AI 아바타의 플레이 학습 현황 (게임별 정책 버전·규칙·최고점, 장르별 학습 레벨)
// 장르별 학습 난이도: 규칙이 단순한 장르는 빨리 오르고(액션/스포츠), 전략·어드벤처는 더 많은 학습이 필요.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Row { game_id: string; version: number; rules: unknown[]; tips: string[]; best_score: number | null; auto_learn?: boolean; auto_count?: number; template_skill?: number; episodes?: { v: number; score: number }[]; demos?: unknown[]; updated_at: string; games: { title: string; genre: string; thumbnail_url: string | null } | null }
const GENRE: Record<string, { label: string; color: string; difficulty: number; why: string }> = {
  action: { label: 'ACTION', color: '#dc2626', difficulty: 2, why: '반사 규칙 위주 — 빨리 배움' },
  sports: { label: 'SPORTS', color: '#059669', difficulty: 2, why: '타이밍·위치 규칙' },
  adventure: { label: 'ADVENTURE', color: '#d97706', difficulty: 3, why: '탐험·선택이 많아 규칙이 복잡' },
  strategy: { label: 'STRATEGY', color: '#2563eb', difficulty: 4, why: '수읽기·자원 관리 — 가장 오래 걸림' },
}
const XP_PER_LEVEL = 40
// 리워드 뱃지 — 총 20단계. 누적 XP(전 장르 합)로 올라간다. 단계가 올라갈수록 필요 XP 가 커진다.
const TIERS = ['새싹', '견습', '초보', '연습생', '루키', '플레이어', '도전자', '숙련', '베테랑', '프로', '에이스', '엘리트', '마스터', '그랜드마스터', '챔피언', '전설', '신화', '오라클', '초월', '비브렉스'] as const
const TIER_COLORS = ['#9ca3af', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#fbbf24', '#fde047', '#ffffff']
const tierNeed = (i: number) => Math.round(60 * Math.pow(1.28, i))   // 1→2 단계 60XP … 19→20 약 4,300XP
const tierOf = (xp: number) => { let t = 0, acc = 0; while (t < TIERS.length - 1 && xp >= acc + tierNeed(t)) { acc += tierNeed(t); t++ } return { tier: t, into: xp - acc, need: tierNeed(t), maxed: t === TIERS.length - 1 } }
const xpOf = (r: Row) => r.version * 10 + (Array.isArray(r.rules) ? r.rules.length : 0) * 6 + (r.template_skill ?? 0) * 15 + (r.best_score && r.best_score > 0 ? 12 : 0)

interface LearnLog { id: string; game_id: string | null; kind: string; title: string; detail: string | null; version: number | null; created_at: string }
const LOG_KIND: Record<string, [string, string]> = { curriculum: ['기본기', '#2563eb'], coach: ['프롬프트 코칭', '#7c3aed'], demo: ['내 플레이 모방', '#0891b2'], reflect: ['자기 반성', '#059669'], revert: ['복귀', '#f59e0b'] }

export default function AiLearningSection() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [logs, setLogs] = useState<LearnLog[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const learnFromDemo = async (gameId: string) => { setBusy(gameId); try { const r = await fetch('/api/ai-bj/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'learnFromDemo', gameId }) }); const j = await r.json(); if (r.ok && j.policy) setRows(rs => (rs ?? []).map(x => x.game_id === gameId ? { ...x, version: j.policy.version, rules: j.policy.rules, tips: j.policy.tips } : x)); else alert(j.error ?? '실패') } finally { setBusy(null) } }
  useEffect(() => {
    createClient().from('aj_play_policies').select('game_id,version,rules,tips,best_score,auto_learn,auto_count,template_skill,episodes,demos,updated_at,games(title,genre,thumbnail_url)').order('updated_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) { setMissing(true); setRows([]) } else setRows((data as unknown as Row[]) ?? []) })
    createClient().from('aj_learn_log').select('*').order('created_at', { ascending: false }).limit(40).then(({ data }) => setLogs((data as LearnLog[] | null) ?? []))
  }, [])
  if (rows === null) return <div className="h-28 rounded-xl bg-[#f6f2ea] animate-pulse" />
  const byGenre: Record<string, { xp: number; games: number }> = {}
  for (const r of rows) { const g = r.games?.genre ?? 'action'; const b = (byGenre[g] ??= { xp: 0, games: 0 }); b.xp += xpOf(r); b.games++ }
  const totalXp = rows.reduce((a, r) => a + xpOf(r), 0)
  const totalRules = rows.reduce((a, r) => a + (Array.isArray(r.rules) ? r.rules.length : 0), 0)
  const totalLessons = rows.reduce((a, r) => a + r.version, 0)
  const totalAuto = rows.reduce((a, r) => a + (r.auto_count ?? 0), 0)
  const allAuto = rows.length === 0 || rows.every(r => r.auto_learn !== false)
  const toggleAuto = async (on: boolean) => { setRows(rs => (rs ?? []).map(r => ({ ...r, auto_learn: on }))); await createClient().from('aj_play_policies').update({ auto_learn: on } as never).in('game_id', rows.map(r => r.game_id)); try { localStorage.setItem('aj-auto-learn', on ? '1' : '0') } catch { /* ignore */ } }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><p className="font-pixel text-[9px] tracking-[0.3em] text-[#2563eb]">AI PLAY LEARNING</p><h3 className="text-[15px] font-bold text-[#241f17] mt-1">내 아바타 플레이 학습 현황</h3><p className="text-[12px] text-[#857a68] mt-0.5">게임에 아바타를 참여시키고 채팅으로 가르치거나, 내가 직접 플레이한 기록(인간 데모)으로 배우게 할 수 있어요. 장르마다 학습 난이도가 달라 레벨이 오르는 속도가 다릅니다.</p></div>
        <div className="flex gap-2">
          {[['가르친 횟수', totalLessons], ['자동 학습', totalAuto], ['학습된 규칙', totalRules], ['학습한 게임', rows.length]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_8px_24px_-18px_rgba(36,31,23,0.25)] px-3 py-2 min-w-[78px] text-center"><p className="text-[10px] text-[#857a68] font-semibold">{l}</p><p className="text-[18px] font-extrabold text-[#241f17] leading-none mt-0.5 tabular-nums">{v as number}</p></div>)}
        </div>
      </div>
      <label className="flex items-start gap-2.5 rounded-xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_8px_24px_-18px_rgba(36,31,23,0.25)] px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={allAuto} onChange={e => toggleAuto(e.target.checked)} className="mt-0.5" />
        <span className="text-[12.5px] text-[#374151]"><b className="text-[#241f17]">자동 학습</b> — 아바타가 대신 플레이하는 동안 3판마다 결과를 스스로 돌아보고 규칙을 조금씩 고쳐요(점수가 떨어지면 잘되던 방식으로 자동 복귀). 내가 채팅으로 가르친 내용은 항상 우선 지켜요.</span>
      </label>
      {/* 리워드 뱃지 — 20단계 */}
      {(() => { const t = tierOf(totalXp); const c = TIER_COLORS[t.tier]; return (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4">
          <div className="flex items-center gap-3">
            <TierBadge tier={t.tier} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#9d9280] uppercase">Reward Badge · {t.tier + 1} / 20</p>
              <p className="text-[16px] font-extrabold text-[#241f17] leading-tight">{TIERS[t.tier]} <span className="text-[12px] font-semibold text-[#857a68]">· 누적 {totalXp} XP</span></p>
              {t.maxed ? <p className="text-[11.5px] text-[#857a68] mt-0.5">최고 단계 달성!</p> : <><div className="mt-1.5 h-2 rounded-full bg-[#f1ece2] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round(t.into / t.need * 100)}%`, background: c }} /></div><p className="text-[11px] text-[#9d9280] mt-1 tabular-nums">다음 &ldquo;{TIERS[t.tier + 1]}&rdquo; 까지 {t.need - t.into} XP</p></>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-10 gap-1.5">
            {TIERS.map((name, i) => <div key={name} className="flex flex-col items-center gap-0.5" title={`${i + 1}단계 ${name}`}><TierBadge tier={i} size={26} locked={i > t.tier} /><span className={`text-[8.5px] leading-none ${i <= t.tier ? 'text-[#4a4337] font-semibold' : 'text-[#c9c0ad]'}`}>{name}</span></div>)}
          </div>
        </div>
      ) })()}
      {/* 장르별 레벨 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(GENRE).map(([g, meta]) => {
          const b = byGenre[g] ?? { xp: 0, games: 0 }
          const need = XP_PER_LEVEL * meta.difficulty
          const level = Math.floor(b.xp / need) + 1, into = b.xp % need, pct = Math.round(into / need * 100)
          return (
            <div key={g} className="rounded-xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_8px_24px_-18px_rgba(36,31,23,0.25)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="font-pixel text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: meta.color }}>{meta.label}</span><span className="text-[12px] text-[#857a68]">난이도 {'★'.repeat(meta.difficulty)}{'☆'.repeat(4 - meta.difficulty)}</span></div>
                <span className="text-[13px] font-extrabold text-[#241f17]">Lv.{level}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#f1ece2] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} /></div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#9d9280]"><span>{meta.why}</span><span className="tabular-nums">{into}/{need} XP · 게임 {b.games}</span></div>
            </div>
          )
        })}
      </div>
      {/* 게임별 */}
      {missing ? <p className="text-[12px] text-[#9d9280]">학습 테이블이 아직 준비되지 않았어요.</p> : rows.length === 0 ? (
        <p className="text-[12.5px] text-[#857a68] rounded-lg border border-dashed border-[#e6dfd0] px-4 py-5 text-center">아직 학습한 게임이 없어요. 게임을 열고 <b>게임 참여</b> → 채팅으로 &ldquo;공이 오른쪽이면 미리 오른쪽으로&rdquo;처럼 가르쳐 보세요. <Link href="/games" className="text-[#2563eb] font-semibold hover:underline">게임 보러 가기 →</Link></p>
      ) : (
        <ul className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] px-4 divide-y divide-[#f1ece2]">
          {rows.map(r => { const g = GENRE[r.games?.genre ?? 'action'] ?? GENRE.action; const n = Array.isArray(r.rules) ? r.rules.length : 0; return (
            <li key={r.game_id} className="flex items-center gap-3 py-2.5">
              <div className="w-12 h-8 rounded-md overflow-hidden bg-[#f1ece2] shrink-0">{r.games?.thumbnail_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.games.thumbnail_url} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><Link href={`/games/${r.game_id}`} className="text-[13.5px] font-semibold text-[#241f17] hover:text-[#2563eb] truncate block">{r.games?.title ?? '게임'}</Link><p className="text-[11px] text-[#9d9280] truncate">{r.tips?.slice(-1)[0] ? `최근 가르침: ${r.tips.slice(-1)[0]}` : '가르친 내용 없음'}</p></div>
              <span className="font-pixel text-[8px] px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: g.color }}>{g.label}</span>
              <div className="text-right shrink-0"><p className="text-[12.5px] font-bold text-[#241f17] tabular-nums">학습 v{r.version} · 규칙 {n}{(r.template_skill ?? 0) > 0 ? ` · 기본기 ${r.template_skill}단계` : ''}{(r.auto_count ?? 0) > 0 ? ` · 자동 ${r.auto_count}` : ''}</p><p className="text-[11px] text-[#9d9280] tabular-nums">{r.best_score != null ? `최고 ${r.best_score.toLocaleString()}점` : '기록 없음'} · XP {xpOf(r)}{Array.isArray(r.demos) && r.demos.length > 0 ? ` · 내 플레이 ${r.demos.length}샘플` : ''}</p>
                {Array.isArray(r.demos) && r.demos.length >= 20 && <button onClick={() => learnFromDemo(r.game_id)} disabled={busy === r.game_id} className="mt-1 h-6 px-2 rounded-full bg-[#241f17] text-white text-[10.5px] font-bold disabled:opacity-50">{busy === r.game_id ? '학습 중…' : '내 플레이로 학습'}</button>}</div>
            </li>) })}
        </ul>
      )}
      {/* 학습 기록 — 언제 무엇을 배웠는지 (기본기/코칭/모방/자기 반성) */}
      {logs && logs.length > 0 && (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#857a68] mb-2">학습 기록</p>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {logs.map(l => { const [lb, c] = LOG_KIND[l.kind] ?? [l.kind, '#6b7280']; const g = rows?.find(r => r.game_id === l.game_id); return (
              <li key={l.id} className="flex items-start gap-2 text-[12px]">
                <span className="shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: c }}>{lb}</span>
                <span className="min-w-0 flex-1 text-[#374151]"><b className="text-[#241f17]">{l.title}</b>{g?.games?.title ? <span className="text-[#9d9280]"> · {g.games.title}</span> : null}{l.detail ? <span className="block text-[11px] text-[#9d9280] truncate">{l.detail}</span> : null}</span>
                <span className="shrink-0 text-[10.5px] text-[#9d9280] tabular-nums">{new Date(l.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{l.version ? ` · v${l.version}` : ''}</span>
              </li>) })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 단계 뱃지 — SVG 메달. 단계가 오를수록 색·광택·별 개수가 늘어난다 */
function TierBadge({ tier, size = 40, locked = false }: { tier: number; size?: number; locked?: boolean }) {
  const c = locked ? '#d9d2c3' : TIER_COLORS[tier]
  const stars = Math.min(5, Math.floor(tier / 4) + 1)
  const id = `tb${tier}${locked ? 'l' : ''}`
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
