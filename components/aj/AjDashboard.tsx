'use client'
// AJ 대시보드 (게임 1개) — 지표 · 최신 리포트 · 분석 실행 · 제안을 스튜디오로 보내기
import { useState } from 'react'
import Link from 'next/link'
import type { GameMetrics } from '@/lib/aj/metrics'
import type { AjReport } from '@/app/api/aj/analyze/route'
import StatCard from '@/components/admin/StatCard'

const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`)
const pct = (v: number) => `${Math.round(v * 100)}%`

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">최근 30일 지표</h2>
          {canRun && <Link href={`/ads?game=${gameId}`} className="font-pixel text-[11px] border border-[#2563eb] text-[#2563eb] px-4 py-2 rounded-md tracking-widest hover:bg-[#2563eb] hover:text-white mr-2">AJ에게 홍보 맡기기</Link>}
          {canRun && <button onClick={run} disabled={running} className="font-pixel text-[11px] bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white px-4 py-2 rounded-md tracking-widest disabled:opacity-50">{running ? 'AJ가 분석 중…' : report ? 'AJ 다시 분석' : 'AJ 분석 실행'}</button>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="플레이 세션" value={m.sessions} sub={`플레이어 ${m.players}명 · 모바일 ${pct(m.mobileRate)}`} />
          <StatCard label="평균 체류" value={fmtDur(m.avgDurationSec)} sub={`중앙값 ${fmtDur(m.medianDurationSec)}`} />
          <StatCard label="30초 내 이탈" value={pct(m.under30sRate)} sub="초반 훅 지표 (낮을수록 좋음)" />
          <StatCard label="코인 수익" value={`${m.coinsPeriod}`} sub={`오늘 ${m.coinsToday} · 7일 ${m.coins7d}`} />
          <StatCard label="평균 점수" value={m.avgScore ?? '-'} sub={m.telemetrySessions ? `텔레메트리 세션 ${m.telemetrySessions}` : '게임이 AJ.score 를 아직 안 보내요'} />
          <StatCard label="첫 게임오버까지" value={m.avgFirstOverSec != null ? fmtDur(m.avgFirstOverSec) : '-'} sub="난이도 지표" />
          <StatCard label="다시하기 비율" value={m.restartRate != null ? pct(m.restartRate) : '-'} sub="게임오버 후 계속한 비율" />
          <StatCard label="조회 · 좋아요 · 공유" value={`${m.views} · ${m.likes} · ${m.shares}`} sub="누적" />
        </div>
      </section>

      {err && <p className="text-red-500 text-sm">{err}</p>}

      {!report ? (
        <div className="border border-dashed border-[#ddd3bf] rounded-2xl p-10 text-center bg-white/60">
          <p className="text-[#241f17] font-semibold">아직 AJ 리포트가 없어요</p>
          <p className="text-[12px] text-[#857a68] mt-1">AJ가 지표·코드·프롬프트를 읽고 재미 점수, 이탈 구간, 업데이트 제안, 방송 대본, 수익 아이디어를 만들어 줍니다.</p>
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
