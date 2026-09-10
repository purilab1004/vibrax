'use client'
// AJ 자율 튜닝 패널 — 크리에이터가 켜고 끄고, 진행 중 카나리 실험을 보고, 중단/되돌리기를 한다.
import { useCallback, useEffect, useState } from 'react'
import type { Experiment } from '@/lib/aj/designer'
import type { DesignSettings, VersionMetrics } from '@/lib/aj/design-score'

interface State { ready: boolean; enabled: boolean; canaryRatio?: number; running: Experiment | null; experiments: Experiment[]; settings: DesignSettings; automation: boolean; external?: boolean }

const STATUS: Record<string, [string, string]> = {
  canary: ['실험 중', '#2563eb'], adopted: ['채택', '#059669'], reverted: ['복귀', '#f59e0b'], inconclusive: ['판정 보류', '#857a68'],
  failed: ['실패', '#e11d48'], vetoed: ['중단', '#6b6152'], generating: ['생성 중', '#7c3aed'], proposed: ['제안', '#9d9280'],
}
const pct = (v: number) => `${Math.round(v * 100)}%`
const sign = (v: number | null | undefined) => (v == null ? '-' : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`)
const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`)

function Compare({ a, b, min }: { a: VersionMetrics | null; b: VersionMetrics | null; min: number }) {
  const rows: [string, string, string][] = [
    ['세션', String(a?.sessions ?? 0), String(b?.sessions ?? 0)],
    ['30초 이탈', a ? pct(a.under30sRate) : '-', b ? pct(b.under30sRate) : '-'],
    ['평균 체류', a ? fmtDur(a.avgDurationSec) : '-', b ? fmtDur(b.avgDurationSec) : '-'],
    ['다시하기', a?.restartRate != null ? pct(a.restartRate) : '-', b?.restartRate != null ? pct(b.restartRate) : '-'],
    ['클리어', a?.clearRate != null ? pct(a.clearRate) : '-', b?.clearRate != null ? pct(b.clearRate) : '-'],
  ]
  const na = a?.sessions ?? 0, nb = b?.sessions ?? 0
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 gap-y-1 text-[12.5px]">
        <span className="text-[#9d9280]" /><span className="font-pixel text-[9px] tracking-widest text-[#857a68]">LIVE</span><span className="font-pixel text-[9px] tracking-widest text-[#2563eb]">CANARY</span>
        {rows.map(([k, x, y]) => (<div key={k} className="contents"><span className="text-[#6b6152]">{k}</span><span className="tabular-nums text-[#241f17]">{x}</span><span className="tabular-nums font-semibold text-[#241f17]">{y}</span></div>))}
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-[#9d9280]"><span>표본 수집</span><span>라이브 {Math.min(na, min)}/{min} · 카나리 {Math.min(nb, min)}/{min}</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-[#f0e9dc] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4]" style={{ width: `${Math.round(Math.min(1, (Math.min(na, min) + Math.min(nb, min)) / (min * 2)) * 100)}%` }} /></div>
      </div>
    </div>
  )
}

export default function AutoDesignPanel({ gameId, canRun }: { gameId: string; canRun: boolean }) {
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const r = await fetch(`/api/aj/design?gameId=${gameId}`); if (r.ok) setSt(await r.json()) } catch { /* ignore */ }
  }, [gameId])
  useEffect(() => { const t = setTimeout(() => { void load() }, 0); return () => clearTimeout(t) }, [load])
  const act = async (action: 'toggle' | 'run' | 'veto' | 'rollback', enabled?: boolean) => {
    setBusy(action); setMsg(null)
    try {
      const r = await fetch('/api/aj/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, action, enabled }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? String(r.status))
      const res = j.result as { kind?: string; reason?: string; verdict?: string } | undefined
      if (action === 'run' && res) {
        const why: Record<string, string> = { low_traffic: '최근 30일 플레이가 부족해요', daily_budget: '오늘 플랫폼 예산을 다 썼어요', monthly_cap: '이 게임은 이번 달 채택 상한에 도달했어요', no_new_hypothesis: '새로 시도할 제안이 없어요 (AJ 리포트를 다시 만들어 보세요)', cost_guard: '원가 가드가 켜져 있어요', report_failed: 'AJ 리포트 생성에 실패했어요', migration_missing: 'DB 마이그레이션이 아직이에요' }
        if (res.kind === 'started') setMsg('실험을 시작했어요. 플레이어 일부에게 새 버전을 보여주고 지표를 비교합니다.')
        else if (res.kind === 'evaluated') setMsg(`진행 중 실험 평가: ${res.reason ?? res.verdict}`)
        else if (res.kind === 'failed') setMsg(`실험 실패: ${res.reason}`)
        else setMsg(why[(res.reason ?? '').split(':')[0]] ?? `건너뜀: ${res.reason}`)
      }
      await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : '요청 실패') } finally { setBusy(null) }
  }
  if (!st) return null
  if (st.external) return null
  const s = st.settings
  const run = st.running
  const lastAdopted = st.experiments.find(e => e.status === 'adopted')
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#ebe4d6] bg-white p-5">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-[radial-gradient(closest-side,rgba(240,90,40,0.14),transparent)]" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">AUTONOMOUS DESIGN AGENT · 자율 튜닝</h3>
          <p className="mt-1 text-[13px] text-[#4a4337] max-w-xl">AJ가 리포트 제안으로 새 버전을 만들고, 플레이어 {Math.round((st.canaryRatio ?? s.canaryRatio) * 100)}%에게 먼저 보여준 뒤 30초 이탈·체류·다시하기·클리어가 좋아졌을 때만 라이브로 바꿔요. 장르·규칙·조작은 건드리지 않고, 언제든 중단하거나 되돌릴 수 있어요.</p>
          {!st.ready && <p className="mt-2 text-[12px] text-[#e11d48]">DB 마이그레이션(2026-09-09-aj-design.sql)이 아직 실행되지 않았어요.</p>}
        </div>
        {canRun && st.ready && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#241f17] cursor-pointer select-none">
              <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${st.enabled ? 'bg-[#2563eb]' : 'bg-[#ddd3bf]'}`} onClick={() => !busy && act('toggle', !st.enabled)}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${st.enabled ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              AJ에게 튜닝 맡기기
            </label>
            {!run && <button onClick={() => act('run')} disabled={!!busy} className="h-9 px-4 rounded-lg bg-[#241f17] text-white text-[12.5px] font-bold hover:bg-[#3a332a] disabled:opacity-50">{busy === 'run' ? 'AJ가 새 버전 만드는 중…' : '지금 실험 시작'}</button>}
          </div>
        )}
      </div>
      {st.enabled && !st.automation && st.ready && <p className="relative mt-2 text-[11.5px] text-[#857a68]">플랫폼 자동 실행은 꺼져 있어요. 진행 중 실험은 계속 평가되고, 새 실험은 &ldquo;지금 실험 시작&rdquo;으로 열 수 있어요.</p>}
      {msg && <p className="relative mt-3 text-[12.5px] text-[#2563eb] bg-[#2563eb]/5 rounded-lg px-3 py-2">{msg}</p>}

      {run && (
        <div className="relative mt-4 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/[0.04] p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-[#241f17]"><span className="font-pixel text-[9px] px-1.5 py-0.5 rounded bg-[#2563eb] text-white">CANARY</span>{run.hypothesis?.title}</p>
              <p className="mt-1 text-[12.5px] text-[#4a4337]">{run.hypothesis?.why}</p>
              <p className="mt-1 text-[11.5px] text-[#9d9280]">시작 {run.started_at ? new Date(run.started_at).toLocaleString() : ''} · 최대 {s.maxDays}일 · 채택 기준 복합 +{Math.round(s.adoptAt * 100)}%{run.score != null ? ` · 현재 ${sign(run.score)}` : ''}</p>
            </div>
            {canRun && <button onClick={() => act('veto')} disabled={!!busy} className="h-8 px-3 rounded-lg border border-[#e11d48] text-[#e11d48] text-[12px] font-bold hover:bg-[#e11d48] hover:text-white disabled:opacity-50">실험 중단</button>}
          </div>
          <div className="mt-3"><Compare a={run.metrics_a} b={run.metrics_b} min={s.minSessions} /></div>
        </div>
      )}

      {st.experiments.length > 0 && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between"><p className="font-pixel text-[10px] tracking-widest text-[#857a68]">HISTORY</p>{canRun && lastAdopted && lastAdopted.base_version_id && <button onClick={() => act('rollback')} disabled={!!busy} className="text-[11.5px] font-semibold text-[#6b6152] hover:text-[#e11d48]">마지막 채택 되돌리기</button>}</div>
          <ul className="mt-2 divide-y divide-[#f0e9dc]">
            {st.experiments.filter(e => e.status !== 'canary').slice(0, 8).map(e => { const [lb, c] = STATUS[e.status] ?? [e.status, '#6b7280']; return (
              <li key={e.id} className="py-2 flex items-start gap-3">
                <span className="mt-0.5 shrink-0 font-pixel text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: c }}>{lb}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#241f17] truncate">{e.hypothesis?.title}</p>
                  <p className="text-[11.5px] text-[#857a68]">{e.note ?? ''}{e.score != null ? ` · 복합 ${sign(e.score)}` : ''}{e.metrics_b ? ` · 카나리 ${e.metrics_b.sessions}세션` : ''}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[#b3a78f] tabular-nums">{new Date(e.decided_at ?? e.created_at).toLocaleDateString()}</span>
              </li>) })}
          </ul>
        </div>
      )}
    </section>
  )
}
