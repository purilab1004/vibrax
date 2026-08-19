'use client'
// AJ 대시보드 (게임 1개) — 지표 · 최신 리포트 · 분석 실행 · 제안을 스튜디오로 보내기
import { useState } from 'react'
import Link from 'next/link'
import type { GameMetrics } from '@/lib/aj/metrics'
import type { AjReport } from '@/app/api/aj/analyze/route'

const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`)
const pct = (v: number) => `${Math.round(v * 100)}%`
// 사용자 화면용 지표 타일 (관리자 StatCard 와 분리 — 트렌디한 카드)
function Tile({ label, value, sub, accent = '#2563eb', icon }: { label: string; value: string | number; sub?: string; accent?: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-[#ebe4d6] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(36,31,23,0.04),0_10px_30px_-18px_rgba(36,31,23,0.25)] hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center justify-between"><p className="text-[12px] font-semibold text-[#857a68]">{label}</p><span className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px]" style={{ background: `${accent}14`, color: accent }}>{icon}</span></div>
      <p className="mt-2 text-[24px] md:text-[26px] leading-none font-extrabold tracking-tight text-[#241f17]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-1.5 text-[11.5px] text-[#9d9280]">{sub}</p>}
    </div>
  )
}

export default function AjDashboard({ gameId, projectId, canRun, initialMetrics, initialReport, reportAt }: {
  gameId: string; projectId: string | null; canRun: boolean; initialMetrics: GameMetrics; initialReport: AjReport | null; reportAt: string | null
}) {
  const [metrics, setMetrics] = useState(initialMetrics)
  const [report, setReport] = useState<AjReport | null>(initialReport)
  const [at, setAt] = useState<string | null>(reportAt)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async () => {
    setRunning(true); setErr(null)
    try {
      const r = await fetch('/api/aj/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? String(r.status))
      setReport(j.report); setMetrics(j.metrics); setAt(new Date().toISOString())
    } catch (e) { setErr(e instanceof Error ? e.message : '분석 실패') } finally { setRunning(false) }
  }
  const m = metrics
  return (
    <div className="space-y-8">
      {/* 지표 */}
      <section>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div><h2 className="text-[18px] font-extrabold tracking-tight text-[#241f17]">최근 30일 지표</h2><p className="text-[12.5px] text-[#857a68] mt-0.5">플레이·체류·수익 데이터로 AJ가 게임을 키워요.</p></div>
          {canRun && <button onClick={run} disabled={running} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[13px] font-bold shadow-[0_8px_22px_rgba(37,99,235,0.35)] hover:shadow-[0_10px_28px_rgba(37,99,235,0.45)] disabled:opacity-50 transition-shadow">{running ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />AJ가 분석 중…</> : report ? 'AJ 다시 분석' : 'AJ 분석 실행'}</button>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile icon="▶" label="플레이 세션" value={m.sessions} sub={`플레이어 ${m.players}명 · 모바일 ${pct(m.mobileRate)}`} />
          <Tile icon="◷" label="평균 체류" value={fmtDur(m.avgDurationSec)} sub={`중앙값 ${fmtDur(m.medianDurationSec)}`} accent="#0891b2" />
          <Tile icon="↯" label="30초 내 이탈" value={pct(m.under30sRate)} sub="초반 훅 지표 (낮을수록 좋음)" accent="#e11d48" />
          <Tile icon="¤" label="코인 수익" value={m.coinsPeriod} sub={`오늘 ${m.coinsToday} · 7일 ${m.coins7d}`} accent="#f59e0b" />
          <Tile icon="★" label="평균 점수" value={m.avgScore ?? '-'} sub={m.telemetrySessions ? `텔레메트리 세션 ${m.telemetrySessions}` : '게임이 AJ.score 를 아직 안 보내요'} accent="#7c3aed" />
          <Tile icon="✕" label="첫 게임오버까지" value={m.avgFirstOverSec != null ? fmtDur(m.avgFirstOverSec) : '-'} sub="난이도 지표" accent="#6b6152" />
          <Tile icon="↺" label="다시하기 비율" value={m.restartRate != null ? pct(m.restartRate) : '-'} sub="게임오버 후 계속한 비율" accent="#059669" />
          <Tile icon="♥" label="조회 · 좋아요 · 공유" value={`${m.views} · ${m.likes} · ${m.shares}`} sub="누적" accent="#db2777" />
        </div>
      </section>

      {err && <p className="text-red-500 text-sm">{err}</p>}

      {!report ? (
        <div className="relative overflow-hidden rounded-3xl border border-[#ebe4d6] bg-white p-8 md:p-10">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.18),transparent)]" />
          <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">AJ BRAIN</p>
              <h3 className="mt-1 text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#241f17]">아직 AJ 리포트가 없어요</h3>
              <p className="mt-2 text-[13.5px] text-[#6b6152] max-w-xl">AJ가 지표·코드·프롬프트를 읽고 <b>재미 점수</b>, <b>이탈 구간</b>, <b>업데이트 제안 프롬프트</b>, <b>방송 대본</b>, <b>수익 아이디어</b>를 만들어 줍니다. 플레이 데이터가 적어도 코드와 기획을 바탕으로 첫 리포트를 만들 수 있어요.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[12px]">{['PLAY', 'DESIGN', 'BJ', 'GROWTH', 'MONETIZATION'].map(t => <span key={t} className="rounded-full border border-[#ebe4d6] bg-[#faf8f3] px-3 h-7 inline-flex items-center font-semibold text-[#6b6152]">{t} AGENT</span>)}</div>
            </div>
            {canRun && <button onClick={run} disabled={running} className="h-12 px-6 rounded-xl bg-[#241f17] text-white text-[14px] font-bold hover:bg-[#3a332a] disabled:opacity-50 whitespace-nowrap">{running ? 'AJ가 분석 중…' : '첫 리포트 만들기'}</button>}
          </div>
        </div>
      ) : (
        <>
          {/* 총평 */}
          <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5 flex items-start gap-5">
            <div className="shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white flex flex-col items-center justify-center shadow-[0_8px_24px_rgba(37,99,235,0.3)]">
              <span className="font-pixel text-[9px] tracking-widest">FUN</span><span className="text-2xl font-black">{report.fun_score}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-[#241f17]">{report.headline}</p>
              <p className="text-[12px] text-[#9d9280] mt-1">AJ 리포트 · {at ? new Date(at).toLocaleString() : ''}</p>
              <p className="text-[13px] text-[#4a4337] mt-2"><b>이탈 구간:</b> {report.dropoff?.where} — {report.dropoff?.why}</p>
              <p className="text-[13px] text-[#4a4337] mt-1"><b>다음 실험:</b> {report.next_experiment}</p>
            </div>
          </section>

          {/* 퍼널 */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(report.funnel ?? []).map((f, i) => (
              <div key={i} className="rounded-xl border border-[#ebe4d6] bg-white p-3">
                <p className="font-pixel text-[9px] text-[#2563eb] tracking-widest">{f.stage}</p>
                <p className="text-[15px] font-bold text-[#241f17] mt-1">{f.value}</p>
                <p className="text-[11px] text-[#857a68] mt-0.5">{f.note}</p>
              </div>
            ))}
          </section>

          {/* 인사이트 + 제안 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
              <h3 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-3">PLAY AGENT · 재미 분석</h3>
              <ul className="space-y-3">
                {(report.insights ?? []).map((it, i) => (<li key={i}><p className="text-[14px] font-semibold text-[#241f17]">{it.title}</p><p className="text-[13px] text-[#4a4337]">{it.body}</p><p className="text-[11px] text-[#9d9280] mt-0.5">근거: {it.evidence}</p></li>))}
              </ul>
            </section>
            <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
              <h3 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-3">GAME DESIGN AGENT · 업데이트 제안</h3>
              <ul className="space-y-3">
                {(report.suggestions ?? []).map((sg, i) => (
                  <li key={i} className="rounded-xl border border-[#ebe4d6] p-3">
                    <p className="flex items-center gap-2 text-[14px] font-semibold text-[#241f17]"><span className={`font-pixel text-[9px] px-1.5 py-0.5 rounded ${sg.impact === 'high' ? 'bg-[#e11d48] text-white' : sg.impact === 'medium' ? 'bg-[#f59e0b] text-white' : 'bg-[#ddd3bf] text-[#4a4337]'}`}>{sg.impact.toUpperCase()}</span>{sg.title}</p>
                    <p className="text-[12.5px] text-[#4a4337] mt-1">{sg.why}</p>
                    <p className="text-[12px] text-[#2563eb] mt-1.5 bg-[#2563eb]/5 rounded p-2">“{sg.prompt}”</p>
                    {projectId && <Link href={`/studio/${projectId}?prompt=${encodeURIComponent(sg.prompt)}`} className="inline-block mt-2 font-pixel text-[10px] border border-[#2563eb] text-[#2563eb] px-3 py-1.5 rounded hover:bg-[#2563eb] hover:text-white tracking-widest">스튜디오에서 적용 →</Link>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* 방송 + 수익 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
              <h3 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-3">BJ AGENT + GROWTH AGENT</h3>
              <p className="text-[13px] text-[#241f17]"><b>오프닝:</b> {report.broadcast?.opening}</p>
              <ul className="mt-2 space-y-1">{(report.broadcast?.hooks ?? []).map((h, i) => <li key={i} className="text-[13px] text-[#4a4337]">• {h}</li>)}</ul>
              <p className="text-[12px] text-[#9d9280] mt-3 font-pixel tracking-widest">SHORTS SCRIPT</p>
              <p className="text-[13px] text-[#4a4337] whitespace-pre-wrap">{report.broadcast?.shorts_script}</p>
              <p className="text-[12px] text-[#9d9280] mt-3 font-pixel tracking-widest">THUMBNAIL</p>
              <p className="text-[18px] font-black text-[#241f17]">{report.broadcast?.thumbnail_title}</p>
            </section>
            <section className="rounded-2xl border border-[#ebe4d6] bg-white p-5">
              <h3 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-3">MONETIZATION AGENT</h3>
              <ul className="space-y-2">{(report.monetization?.ideas ?? []).map((it, i) => (<li key={i}><p className="text-[14px] font-semibold text-[#241f17]">{it.title}</p><p className="text-[13px] text-[#4a4337]">{it.body}</p></li>))}</ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
