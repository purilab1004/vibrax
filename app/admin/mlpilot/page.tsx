'use client'
// MLPilot — 프롬프트 → 템플릿 매핑(LLM 없이 자체 처리) 현황·학습. v1 = 키워드 + 문자 n-gram 유사도, ML 모델은 같은 슬롯에 교체 예정.
import { useCallback, useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, Badge, SectionTitle, Segmented, Skeleton, Toggle, Toast, Modal, btn, input, label as labelCls, th, td, trHover } from '@/components/admin/ui'

interface Row { id: string; prompt: string; template_slug: string | null; method: string; confidence: number | null; used_llm: boolean; created_at: string; suggestions?: { slug: string; name: string; score: number }[] }
interface Data { days: number; settings: { enabled: boolean; threshold: number; model: string }; total: number; free: number; ratio: number; byMethod: Record<string, number>; byDay: { day: string; total: number; free: number }[]; unmapped: Row[]; recent: Row[]; templates: { slug: string; name: string }[] }
const METHOD: Record<string, [string, string]> = { keyword: ['키워드', '#2563eb'], similarity: ['유사도', '#7c3aed'], manual: ['수동 학습', '#059669'], ml: ['ML 모델', '#0891b2'], none: ['LLM 생성', '#f59e0b'] }

export default function MlPilotPage() {
  const [days, setDays] = useState(30)
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<{ msg: string; missing?: boolean } | null>(null)
  const [thr, setThr] = useState(0.42)
  const [teach, setTeach] = useState<Row | null>(null); const [tSlug, setTSlug] = useState(''); const [tKw, setTKw] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = useCallback(async (dd: number) => { const r = await fetch(`/api/admin/mlpilot?days=${dd}`); const j = await r.json(); if (!r.ok) setErr({ msg: j.error, missing: j.missing }); else { setD(j); setThr(j.settings.threshold) } }, [])
  useEffect(() => { const t = setTimeout(() => load(days), 0); return () => clearTimeout(t) }, [days, load])
  const patch = async (b: Record<string, unknown>) => { const r = await fetch('/api/admin/mlpilot', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); if (r.ok) { say('저장했어요.'); load(days) } }
  const header = <PageHeader title="MLPilot" badge={<span className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: '#7c3aed' }}>Mapping Engine</span>} desc="프롬프트를 LLM 대신 자체 템플릿으로 매핑해 프롬코인만 쓰고 원가는 0 으로. v1 은 키워드 + 문자 n-gram 유사도, 여기서 쌓인 프롬프트 데이터로 나중에 ML 모델(임베딩/분류기)을 같은 슬롯에 붙입니다."
    actions={<Segmented value={days} onChange={setDays} options={[{ value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]} />} />
  if (err) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{err.missing ? <>매핑 로그 테이블이 없어요. <code>db/migrations/2026-08-19-mlpilot.sql</code> 을 실행하세요.</> : err.msg}</Card></div>
  if (!d) return <div>{header}<Skeleton rows={6} /></div>
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        <StatCard label="LLM 없이 처리율" value={`${Math.round(d.ratio * 100)}%`} sub={`${d.free}/${d.total} 프롬프트`} accent={d.ratio >= 0.5 ? '#059669' : '#f59e0b'} />
        <StatCard label="키워드 매핑" value={d.byMethod.keyword ?? 0} accent="#2563eb" />
        <StatCard label="유사도 매핑" value={d.byMethod.similarity ?? 0} accent="#7c3aed" />
        <StatCard label="LLM 생성" value={d.byMethod.none ?? 0} accent="#f59e0b" />
        <StatCard label="모델" value={d.settings.model} sub={d.settings.enabled ? `임계값 ${d.settings.threshold}` : '꺼짐'} accent="#0891b2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mb-3">
        <TrendChart label="일별 프롬프트 (LLM 없이 처리)" values={d.byDay.map(x => x.free)} labels={d.byDay.map(x => x.day.slice(5))} color="#7c3aed" />
        <Card className="p-4 space-y-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">매퍼 설정</p>
          <Toggle checked={d.settings.enabled} onChange={v => patch({ enabled: v })} label="유사도 매핑 사용 (키워드로 못 잡은 프롬프트를 가장 가까운 템플릿으로)" />
          <div><label className={labelCls}>임계값 (0.2 공격적 ~ 0.7 보수적)</label><div className="flex items-center gap-2"><input type="number" step={0.02} min={0.1} max={0.9} value={thr} onChange={e => setThr(Number(e.target.value))} className={input + ' !w-24'} /><button onClick={() => patch({ threshold: thr })} className={btn.primary}>저장</button></div></div>
          <p className="text-[11.5px] text-[#9aa1ad]">낮추면 더 많은 프롬프트가 템플릿으로 처리돼 원가가 줄지만 엉뚱한 게임이 나올 위험이 커져요. 아래 미매핑 프롬프트를 &ldquo;학습&rdquo;으로 키워드에 넣는 게 가장 안전한 방법.</p>
        </Card>
      </div>
      <Card className="overflow-hidden mb-3">
        <SectionTitle right={<span>LLM 을 썼던 프롬프트 — 템플릿에 학습시키면 다음부턴 원가 0</span>}>미매핑 프롬프트 (학습 대기)</SectionTitle>
        {d.unmapped.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">미매핑 프롬프트가 없어요.</p> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>프롬프트</th><th className={th}>가장 비슷한 템플릿</th><th className={th}>시각</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{d.unmapped.map(r => (
              <tr key={r.id} className={trHover}>
                <td className={`${td} max-w-[420px]`}><p className="truncate" title={r.prompt}>{r.prompt}</p></td>
                <td className={td}><div className="flex flex-wrap gap-1">{(r.suggestions ?? []).map(sg => <button key={sg.slug} onClick={() => { setTeach(r); setTSlug(sg.slug); setTKw(r.prompt.slice(0, 40)) }} className="rounded border border-[#d9dde5] bg-white px-2 h-7 text-[11.5px] hover:border-[#7c3aed] hover:text-[#7c3aed]">{sg.name} <span className="text-[#9aa1ad]">{sg.score}</span></button>)}</div></td>
                <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(r.created_at).toLocaleString()}</td>
                <td className={td}><button onClick={() => { setTeach(r); setTSlug(r.suggestions?.[0]?.slug ?? ''); setTKw(r.prompt.slice(0, 40)) }} className={btn.ghost + ' !h-8'}>학습</button></td>
              </tr>))}</tbody></table></div>
        )}
      </Card>
      <Card className="overflow-hidden">
        <SectionTitle>최근 매핑 로그</SectionTitle>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto"><table className="w-full">
          <thead><tr><th className={th}>시각</th><th className={th}>프롬프트</th><th className={th}>방법</th><th className={th}>템플릿</th><th className={`${th} text-right`}>신뢰도</th><th className={th}>LLM</th></tr></thead>
          <tbody className="divide-y divide-[#eef0f4]">{d.recent.map(r => { const [l, c] = METHOD[r.method] ?? [r.method, '#6b7280']; return (
            <tr key={r.id} className={trHover}><td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(r.created_at).toLocaleString()}</td><td className={`${td} max-w-[360px] truncate`} title={r.prompt}>{r.prompt}</td><td className={td}><Badge color={c}>{l}</Badge></td><td className={`${td} font-mono text-[11px]`}>{r.template_slug ?? '-'}</td><td className={`${td} text-right tabular-nums`}>{r.confidence != null ? r.confidence.toFixed(2) : '-'}</td><td className={td}>{r.used_llm ? <Badge color="#f59e0b">사용</Badge> : <Badge color="#059669">없음</Badge>}</td></tr>) })}</tbody></table></div>
      </Card>
      <Modal open={!!teach} onClose={() => setTeach(null)} title="템플릿에 학습시키기">
        {teach && <div className="space-y-4">
          <p className="text-[13px] text-[#374151]">&ldquo;{teach.prompt}&rdquo;</p>
          <div><label className={labelCls}>매핑할 템플릿</label><select value={tSlug} onChange={e => setTSlug(e.target.value)} className={input}><option value="">선택</option>{d.templates.map(t => <option key={t.slug} value={t.slug}>{t.name} ({t.slug})</option>)}</select></div>
          <div><label className={labelCls}>키워드로 등록할 표현 (프롬프트에 이 표현이 있으면 이 템플릿)</label><input value={tKw} onChange={e => setTKw(e.target.value)} className={input} /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setTeach(null)} className={btn.ghost}>취소</button><button disabled={!tSlug || !tKw.trim()} onClick={async () => { const r = await fetch('/api/admin/mlpilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: tSlug, keyword: tKw, mappingId: teach.id }) }); say(r.ok ? '학습했어요 — 같은 표현은 이제 LLM 없이 처리돼요.' : '실패'); setTeach(null); load(days) }} className={btn.primary}>학습</button></div>
        </div>}
      </Modal>
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
