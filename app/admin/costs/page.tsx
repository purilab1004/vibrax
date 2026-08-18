'use client'
// 관리자 — LLM 원가 대시보드 (llm_usage 집계). 문서 "LLM 토큰 원가 분석 및 크레딧 가격 정책"의 실측치 버전.
import { useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, Segmented, Skeleton, Toast, Toggle, btn, input as inputCls, label as labelCls, th, td, trHover } from '@/components/admin/ui'
import { MODEL_CATALOG, type RouterPolicy, type Task } from '@/lib/llm/router'

interface Data {
  savings: { baseline: number; actual: number; saved: number; templateSaved: number; routingSaved: number; ratio: number }
  policy: RouterPolicy
  days: number
  pricing: { models: Record<string, { input: number; output: number; label: string }>; krwPerUsd: number; intro: { input: number; output: number; until: string }; generationCost: number; maxTokens: number }
  totals: { calls: number; genCalls: number; llmGenCalls: number; templateLoads: number; inputTokens: number; outputTokens: number; costUsd: number; credits: number; avgOutputPerGen: number; medianOutputPerGen: number; maxOutputPerGen: number; costPerGenCall: number; projects: number; avgCallsPerProject: number; avgCostPerProject: number }
  byKind: Record<string, { calls: number; input: number; output: number; cost: number; credits: number }>
  byModel: Record<string, { calls: number; input: number; output: number; cost: number }>
  byDay: { day: string; calls: number; cost: number; credits: number }[]
  topUsers: { id: string; name: string; calls: number; cost: number; credits: number }[]
  heaviest: { id: string; kind: string; output_tokens: number; input_tokens: number; cost_usd: number; created_at: string; template_slug: string | null }[]
  recent: { id: string; kind: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number; credits: number; template_slug: string | null; created_at: string }[]
}

const KIND_LABEL: Record<string, string> = { create: '새 게임 생성', edit: '기존 게임 수정', template: '템플릿 로드', template_edit: '템플릿+수정', explain: '학습 노트', from_image: '사진→레시피', bj_chat: 'AJ 중계' }
const krw = (usd: number, rate: number) => `₩${Math.round(usd * rate).toLocaleString()}`
const usd = (v: number) => `$${v.toFixed(v < 1 ? 3 : 2)}`

export default function AdminCostsPage() {
  const [days, setDays] = useState(30)
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null }>({ days: 0, data: null, err: null })
  const data = state.days === days ? state.data : null
  const err = state.days === days ? state.err : null
  // 가격 정책 시뮬레이터 입력
  const [margin, setMargin] = useState(3)
  const [packCredits, setPackCredits] = useState(100)
  // TokenPilot 정책 편집
  const [pol, setPol] = useState<RouterPolicy | null>(null)
  const [savingPol, setSavingPol] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const policy = pol ?? data?.policy ?? null
  const savePolicy = async () => {
    if (!policy) return
    setSavingPol(true)
    const r = await fetch('/api/admin/tokenpilot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) })
    setSavingPol(false)
    setToast(r.ok ? '라우팅 정책을 저장했어요. 다음 생성부터 적용돼요.' : '저장 실패'); setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => {
    let alive = true
    fetch(`/api/admin/costs?days=${days}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.hint ?? j.error ?? String(r.status)); return j as Data })
      .then((d) => { if (alive) setState({ days, data: d, err: null }) })
      .catch((e) => { if (alive) setState({ days, data: null, err: e.message }) })
    return () => { alive = false }
  }, [days])

  const header = (
    <PageHeader title="TokenPilot" badge={<span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: '#0891b2' }}>Cost Engine</span>} desc={<>LLM 최저가 라우팅 · 원가 측정 · 가격 정책 엔진 — 작업마다 <b>품질 하한을 만족하는 가장 싼 모델</b>을 고르고, 실측 원가로 크레딧 가격과 마진을 계산해요. 외부 서비스도 <code>/api/tokenpilot/estimate</code> 로 사용할 수 있어요.</>}
      actions={<Segmented value={days} onChange={setDays} options={[7, 30, 90, 365].map(d => ({ value: d, label: `${d}일` }))} />} />
  )
  if (err) return <div>{header}<p className="text-red-600 text-[13px] rounded-xl border border-red-200 bg-red-50 px-4 py-3">{err}</p></div>
  if (!data) return <div>{header}<Skeleton rows={6} /></div>
  const t = data.totals, R = data.pricing.krwPerUsd
  const perCallKrw = t.costPerGenCall * R
  const sellPerCall = perCallKrw * margin
  const packPrice = sellPerCall * (packCredits / data.pricing.generationCost)

  return (
    <div className="space-y-6">
      {header}

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="API 원가 (기간 합계)" value={usd(t.costUsd)} sub={`${krw(t.costUsd, R)} · 정가 기준`} />
        <StatCard label="생성/수정 호출" value={t.genCalls} sub={`LLM ${t.llmGenCalls} · 템플릿 로드 ${t.templateLoads}`} />
        <StatCard label="호출 1회 평균 원가" value={krw(t.costPerGenCall, R)} sub={`${usd(t.costPerGenCall)} · 템플릿 로드 포함 평균`} />
        <StatCard label="차감 크레딧 합계" value={t.credits} sub={`≈ ${Math.round(t.credits / data.pricing.generationCost)}회 · 회당 ${data.pricing.generationCost}크레딧`} />
        <StatCard label="출력 토큰 평균/생성" value={Math.round(t.avgOutputPerGen)} sub={`중앙값 ${t.medianOutputPerGen.toLocaleString()} · 최대 ${t.maxOutputPerGen.toLocaleString()} · 상한 ${data.pricing.maxTokens.toLocaleString()}`} />
        <StatCard label="게임(프로젝트) 수" value={t.projects} sub={`프로젝트당 평균 ${t.avgCallsPerProject.toFixed(1)}회 호출`} />
        <StatCard label="게임 1개 평균 원가" value={krw(t.avgCostPerProject, R)} sub={`${usd(t.avgCostPerProject)} · 인프라비 제외`} />
        <StatCard label="총 토큰" value={`${(t.inputTokens / 1000).toFixed(0)}k / ${(t.outputTokens / 1000).toFixed(0)}k`} sub="입력 / 출력" />
      </div>

      {/* 절감 효과 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="TokenPilot 절감액" value={krw(data.savings.saved, R)} sub={`전부 Sonnet 으로 했을 때 ${krw(data.savings.baseline, R)} → 실제 ${krw(data.savings.actual, R)}`} accent="#059669" />
        <StatCard label="절감률" value={`${Math.round(data.savings.ratio * 100)}%`} sub="기간 합계 기준" accent="#059669" />
        <StatCard label="템플릿 엔진 절감" value={krw(data.savings.templateSaved, R)} sub="LLM 호출 없이 로드된 게임" accent="#0891b2" />
        <StatCard label="모델 라우팅 절감" value={krw(data.savings.routingSaved, R)} sub="Haiku 등 저가 모델로 처리한 몫" accent="#0891b2" />
      </div>

      {/* 라우팅 정책 */}
      {policy && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div><h2 className="text-[14px] font-bold text-[#1f2430]">라우팅 정책</h2><p className="text-[12px] text-[#6b7280]">작업별 모델 고정 · 작은 수정 자동 다운그레이드 · 목표 마진. 저장 즉시 스튜디오 생성에 반영돼요.</p></div>
            <button onClick={savePolicy} disabled={savingPol} className={btn.primary}>{savingPol ? '저장 중…' : '정책 저장'}</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr><th className={th}>작업</th><th className={th}>모델</th><th className={th}>최소 품질</th><th className={th}>메모</th></tr></thead>
                <tbody>
                  {([['create', '새 게임 생성', 4, '가장 무거움 — 품질 우선'], ['edit', '기존 게임 수정', 4, '작은 수정은 자동 다운그레이드 가능'], ['template_edit', '템플릿 + 수정', 4, '베이스가 있어 출력이 짧음'], ['explain', '학습 노트', 3, '설명·요약 — Haiku 충분'], ['bj_chat', 'AJ 중계/채팅', 3, '짧은 대화'], ['aj_report', 'AJ 리포트', 4, '지표 해석·제안']] as [Task, string, number, string][]).map(([t, l, tier, memo]) => (
                    <tr key={t} className={`border-t border-[#f0eadf] ${trHover}`}>
                      <td className={td}><span className="font-semibold text-[#1f2430]">{l}</span><span className="text-[#9aa1ad] ml-1.5 font-mono text-[11px]">{t}</span></td>
                      <td className={td}>
                        <select value={policy.pins[t] ?? ''} onChange={e => setPol({ ...policy, pins: { ...policy.pins, [t]: e.target.value || undefined } })} className="h-8 rounded-md border border-[#d9dde5] bg-white px-2 text-[12.5px] outline-none focus:border-[#2563eb]">
                          <option value="">자동(최저가)</option>
                          {Object.keys(MODEL_CATALOG).map(m => <option key={m} value={m}>{data.pricing.models[m]?.label ?? m} · ${data.pricing.models[m]?.output}/1M out</option>)}
                        </select>
                      </td>
                      <td className={td}>등급 {tier}+</td>
                      <td className={`${td} text-[#6b7280]`}>{memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-[#f7f8fa] p-4 space-y-3">
                <Toggle checked={policy.autoDowngradeSmallEdits} onChange={v => setPol({ ...policy, autoDowngradeSmallEdits: v })} label="작은 수정은 Haiku 로 자동 다운그레이드" />
                <div><label className={labelCls}>작은 수정 기준 (HTML 글자 수 이하)</label><input type="number" value={policy.smallEditMaxHtmlChars} onChange={e => setPol({ ...policy, smallEditMaxHtmlChars: Number(e.target.value) })} className={inputCls} /></div>
              </div>
              <div className="rounded-xl bg-[#f7f8fa] p-4 space-y-3">
                <div><label className={labelCls}>목표 마진 배수</label><input type="number" step={0.5} value={policy.targetMargin} onChange={e => setPol({ ...policy, targetMargin: Number(e.target.value) })} className={inputCls} /></div>
                <div><label className={labelCls}>크레딧 1개 목표 판매가 (₩)</label><input type="number" value={policy.krwPerCredit} onChange={e => setPol({ ...policy, krwPerCredit: Number(e.target.value) })} className={inputCls} /></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 모델 카탈로그 + 엔진 API */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">모델 카탈로그 · 품질 등급</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>모델</th><th className={th}>등급</th><th className={th}>단가 in/out ($/1M)</th><th className={th}>강점</th></tr></thead>
            <tbody>
              {Object.entries(MODEL_CATALOG).map(([m, c]) => (
                <tr key={m} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td} font-semibold text-[#1f2430]`}>{data.pricing.models[m]?.label ?? m}</td><td className={td}>{'★'.repeat(c.tier)}<span className="text-[#ddd3bf]">{'★'.repeat(5 - c.tier)}</span></td><td className={td}>${data.pricing.models[m]?.input} / ${data.pricing.models[m]?.output}</td><td className={`${td} text-[#6b7280]`}>{c.strengths.join(' · ')}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-1">엔진 API — 다른 서비스도 사용</h2>
          <p className="text-[12px] text-[#6b7280] mb-3">환경변수 <code>TOKENPILOT_API_KEYS</code>(쉼표 구분)에 키를 넣으면 외부에서 호출할 수 있어요. 응답: 추천 모델·후보별 원가·권장 판매가·크레딧.</p>
          <pre className="rounded-xl bg-[#241f17] text-[#e8e2d4] text-[11.5px] leading-relaxed p-4 overflow-x-auto">{`POST https://vibrexcup.com/api/tokenpilot/estimate
Authorization: Bearer <YOUR_KEY>
{ "task": "create", "output_tokens": 12000, "quality": "balanced" }

→ { "recommended": "claude-sonnet-5",
    "estimate": { "costKrw": 262, "sellKrw": 786, "credits": 16 },
    "candidates": [ { "model": "claude-haiku-4-5", "eligible": false, ... }, ... ] }`}</pre>
          <p className="text-[11.5px] text-[#9aa1ad] mt-2">GET 은 인증 없이 카탈로그·작업 목록을 돌려줘요.</p>
        </Card>
      </div>

      {/* 가격 시뮬레이터 */}
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <h2 className="text-[14px] font-bold text-[#1f2430]">가격 정책 시뮬레이터</h2>
          <label className="text-[12px] text-[#6b7280] flex items-center gap-2">마진 배수 <input type="number" step={0.5} min={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-16 h-8 rounded-md border border-[#d9dde5] px-2 text-sm outline-none focus:border-[#2563eb]" /></label>
          <label className="text-[12px] text-[#6b7280] flex items-center gap-2">팩 크레딧 <input type="number" step={10} min={10} value={packCredits} onChange={(e) => setPackCredits(Number(e.target.value))} className="w-20 h-8 rounded-md border border-[#d9dde5] px-2 text-sm outline-none focus:border-[#2563eb]" /></label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="호출 1회 원가(실측)" value={`₩${Math.round(perCallKrw).toLocaleString()}`} sub="템플릿 로드(₩0) 포함 평균" />
          <StatCard label={`판매가/회 (×${margin})`} value={`₩${Math.round(sellPerCall).toLocaleString()}`} sub={`${data.pricing.generationCost}크레딧`} />
          <StatCard label={`${packCredits}크레딧 팩 권장가`} value={`₩${Math.round(packPrice / 100) * 100 >= 0 ? (Math.round(packPrice / 100) * 100).toLocaleString() : 0}`} sub={`= ${packCredits / data.pricing.generationCost}회`} />
          <StatCard label="9월 정가 전환 영향" value={`+${Math.round(((data.pricing.models['claude-sonnet-5'].output / data.pricing.intro.output) - 1) * 100)}%`} sub={`인트로 $${data.pricing.intro.input}/$${data.pricing.intro.output} → 정가 $${data.pricing.models['claude-sonnet-5'].input}/$${data.pricing.models['claude-sonnet-5'].output} (${data.pricing.intro.until}까지)`} />
        </div>
        <p className="text-[11px] text-[#9aa1ad] mt-3">위 원가는 정가 기준(₩{R}/$). 게임 1개는 보통 첫 생성 1회 + 수정 3~5회. 인프라(Vercel·Supabase·TTS)는 별도이므로 실질 원가는 게임당 +₩300~500 정도로 보세요.</p>
      </Card>

      {/* 추이 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TrendChart label="일별 API 원가 (USD ×100)" sub={`최근 ${data.days}일`} values={data.byDay.map((d) => Math.round(d.cost * 100))} labels={data.byDay.map((d) => d.day.slice(5))} color="#e11d48" />
        <TrendChart label="일별 호출 수" sub={`최근 ${data.days}일`} values={data.byDay.map((d) => d.calls)} labels={data.byDay.map((d) => d.day.slice(5))} color="#0891b2" />
      </div>

      {/* 종류별 / 모델별 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">종류별</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>종류</th><th className={th}>호출</th><th className={th}>평균 출력</th><th className={th}>원가</th><th className={th}>크레딧</th></tr></thead>
            <tbody>
              {Object.entries(data.byKind).sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => (
                <tr key={k} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td}`}>{KIND_LABEL[k] ?? k}</td><td className={td}>{v.calls}</td><td className={td}>{v.calls ? Math.round(v.output / v.calls).toLocaleString() : 0}</td><td className={td}>{usd(v.cost)} <span className="text-[#9aa1ad]">({krw(v.cost, R)})</span></td><td className={td}>{v.credits}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">모델별 · 단가</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>모델</th><th className={th}>호출</th><th className={th}>입력/출력 토큰</th><th className={th}>원가</th><th className={th}>단가(in/out $/1M)</th></tr></thead>
            <tbody>
              {Object.entries(data.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([m, v]) => (
                <tr key={m} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td}`}>{data.pricing.models[m]?.label ?? m}</td><td className={td}>{v.calls}</td><td className={td}>{(v.input / 1000).toFixed(1)}k / {(v.output / 1000).toFixed(1)}k</td><td className={td}>{usd(v.cost)}</td><td className={td}>${data.pricing.models[m]?.input ?? '-'} / ${data.pricing.models[m]?.output ?? '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* 무거운 호출 / 상위 사용자 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">가장 무거운 호출 TOP 10 (출력 토큰)</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>일시</th><th className={th}>종류</th><th className={th}>출력</th><th className={th}>원가</th></tr></thead>
            <tbody>
              {data.heaviest.map((r) => (
                <tr key={r.id} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td}`}>{new Date(r.created_at).toLocaleString()}</td><td className={td}>{KIND_LABEL[r.kind] ?? r.kind}{r.template_slug ? ` · ${r.template_slug}` : ''}</td><td className={`${td} ${r.output_tokens > 20000 ? 'text-red-500 font-bold' : ''}`}>{r.output_tokens.toLocaleString()}</td><td className={td}>{krw(Number(r.cost_usd), R)}</td></tr>
              ))}
              {data.heaviest.length === 0 && <tr><td colSpan={4} className={`${td} text-[#9aa1ad]`}>아직 기록이 없어요</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">원가 상위 사용자</h2>
          <table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>사용자</th><th className={th}>호출</th><th className={th}>원가</th><th className={th}>차감 크레딧</th><th className={th}>마진</th></tr></thead>
            <tbody>
              {data.topUsers.map((u) => {
                const rev = u.credits * (sellPerCall / data.pricing.generationCost)
                return <tr key={u.id} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td}`}>{u.name}</td><td className={td}>{u.calls}</td><td className={td}>{krw(u.cost, R)}</td><td className={td}>{u.credits}</td><td className={`${td} font-semibold ${u.cost * R > rev ? '!text-red-500' : '!text-[#16a34a]'}`}>{u.cost > 0 ? `${(rev / (u.cost * R)).toFixed(1)}×` : '-'}</td></tr>
              })}
              {data.topUsers.length === 0 && <tr><td colSpan={5} className={`${td} text-[#9aa1ad]`}>아직 기록이 없어요</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {/* 최근 호출 */}
      <Card className="p-5">
        <h2 className="text-[14px] font-bold text-[#1f2430] mb-3">최근 호출 50건</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[640px]">
            <thead><tr><th className={th}>일시</th><th className={th}>종류</th><th className={th}>모델</th><th className={th}>입력</th><th className={th}>출력</th><th className={th}>원가</th><th className={th}>크레딧</th></tr></thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className={`border-t border-[#f0eadf] ${trHover}`}><td className={`${td} whitespace-nowrap`}>{new Date(r.created_at).toLocaleString()}</td><td className={td}>{KIND_LABEL[r.kind] ?? r.kind}{r.template_slug ? ` · ${r.template_slug}` : ''}</td><td className={td}>{data.pricing.models[r.model]?.label ?? r.model}</td><td className={td}>{r.input_tokens.toLocaleString()}</td><td className={td}>{r.output_tokens.toLocaleString()}</td><td className={td}>{usd(Number(r.cost_usd))}</td><td className={td}>{r.credits}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
