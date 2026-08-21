'use client'
// MLPilot v2 — AJ 대화 학습 엔진. 예시/규칙 지식베이스 → 런타임 프롬프트 주입 → 피드백 → 학습. (구 템플릿 매핑은 마지막 탭)
// 설계: docs/superpowers/specs/2026-08-19-mlpilot-aj-talk-design.md
import AutoPanel from '@/components/admin/AutoPanel'
import MappingTab from '@/components/admin/mlpilot/MappingTab'
import { useCallback, useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, Segmented, Skeleton, Toggle, Toast, Modal, ConfirmModal, btn, input, label as labelCls, th, td, trHover, Pager, usePager } from '@/components/admin/ui'

type Tab = 'overview' | 'examples' | 'rules' | 'curriculum' | 'upload' | 'connect' | 'feedback' | 'mapping'
interface Meta { situations: string[]; emotions: string[]; ruleKinds: string[]; situationLabel: Record<string, string>; emotionLabel: Record<string, string> }
interface Overview { settings: { enabled: boolean; maxExamples: number; maxRuleChars: number; logSample: number; ingestKey: string | null; hasKey: boolean; labelModel: string }; counts: { examples: number; approved: number; pending: number; rules: number; feedback: number; feedback7: number }; bySituation: Record<string, number>; byEmotion: Record<string, number>; byGenre: Record<string, number>; sources: Source[]; meta: Meta }
interface Example { id: string; source: string; genre: string | null; situation: string; emotion: string | null; trigger_text: string | null; utterance: string; lang: string | null; tags: string[]; quality: number; approved: boolean; uses: number; created_at: string }
interface Rule { id: string; scope: string; genre: string | null; game_id: string | null; kind: string; title: string | null; content: string; priority: number; enabled: boolean; created_at: string }
interface Source { id: string; kind: string; name: string; genre: string | null; rows_total: number; rows_imported: number; status: string; created_at: string }
interface Feedback { id: string; genre: string; situation: string; emotion: string | null; viewer_text: string | null; utterance: string; example_ids: string[]; rating: number | null; created_at: string }
const GENRES = ['action', 'adventure', 'strategy', 'puzzle', 'sports', 'rpg', 'arcade', 'casual', 'shooter', 'racing', 'simulation', 'horror']
const SRC_LABEL: Record<string, [string, string]> = { admin: ['직접 입력', '#2563eb'], csv: ['CSV', '#0891b2'], md: ['MD 가이드', '#7c3aed'], human_bj: ['인간 BJ', '#e11d48'], webhook: ['웹훅', '#f59e0b'], auto: ['자동 승격', '#059669'] }
const api = async (method: string, body?: unknown) => { const r = await fetch('/api/admin/mlpilot/talk', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); return { ok: r.ok, ...j } as { ok: boolean; error?: string } & Record<string, unknown> }

const PIPE = [
  ['소스', 'CSV · MD · 인간 BJ 트랜스크립트 · 웹훅(n8n) · 직접 입력', '#0891b2'],
  ['라벨링', 'Haiku 가 상황·감정·트리거 자동 태깅', '#7c3aed'],
  ['예시·규칙 DB', '승인된 것만 AJ 가 사용', '#2563eb'],
  ['프롬프트 합성', '페르소나 + 게임 + 규칙 + 상황별 예시 + 상대 말투', '#059669'],
  ['AJ 발화', 'Haiku 스트리밍 (≈ $0.0003/건)', '#f59e0b'],
  ['피드백', '발화 로그 · 시청자 반응 · 관리자 평가', '#e11d48'],
  ['학습', '품질 점수 갱신 · 고성과 발화 승격', '#1f2430'],
] as const

export default function MlPilotPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [ov, setOv] = useState<Overview | null>(null)
  const [err, setErr] = useState<{ msg: string; missing?: boolean } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600) }
  const loadOv = useCallback(async () => { const r = await fetch('/api/admin/mlpilot/talk'); const j = await r.json(); if (!r.ok) setErr({ msg: j.error, missing: j.missing }); else { setErr(null); setOv(j) } }, [])
  useEffect(() => { const t = setTimeout(loadOv, 0); return () => clearTimeout(t) }, [loadOv])
  const header = <PageHeader title="MLPilot" badge={<span className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: '#7c3aed' }}>AJ Talk Engine</span>}
    desc="AJ 가 게임·상황·감정·상대 말투에 맞게 말하도록 대화 데이터를 축적하고 학습하는 엔진. 인간 BJ 대사, CSV, MD 가이드, 외부 자동화(n8n) 로 데이터를 넣으면 AJ 프롬프트에 상황별 예시·규칙으로 주입되고, 피드백으로 품질이 갱신됩니다."
    actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: '개요' }, { value: 'examples', label: `예시 ${ov ? ov.counts.examples : ''}` }, { value: 'rules', label: `규칙 ${ov ? ov.counts.rules : ''}` }, { value: 'curriculum', label: '봇 기본기' }, { value: 'upload', label: '업로드' }, { value: 'connect', label: '연결' }, { value: 'feedback', label: '피드백' }, { value: 'mapping', label: '템플릿 매핑' }]} />} />
  if (tab === 'mapping') return <div>{header}<AutoPanel module="mlpilot" /><MappingTab /></div>
  if (err) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{err.missing ? <>AJ 대화 학습 테이블이 없어요. <code>db/migrations/2026-08-19-mlpilot-talk.sql</code> 을 실행하세요.</> : err.msg}</Card></div>
  if (!ov) return <div>{header}<Skeleton rows={6} /></div>
  return (
    <div>
      {header}
      <AutoPanel module="mlpilot" />
      {tab === 'overview' && <OverviewTab ov={ov} reload={loadOv} say={say} />}
      {tab === 'examples' && <ExamplesTab meta={ov.meta} say={say} reload={loadOv} />}
      {tab === 'rules' && <RulesTab meta={ov.meta} say={say} reload={loadOv} />}
      {tab === 'curriculum' && <CurriculumTab say={say} />}
      {tab === 'upload' && <UploadTab ov={ov} say={say} reload={loadOv} />}
      {tab === 'connect' && <ConnectTab ov={ov} say={say} reload={loadOv} />}
      {tab === 'feedback' && <FeedbackTab meta={ov.meta} say={say} />}
      <Toast msg={toast} kind="ok" />
    </div>
  )
}

function OverviewTab({ ov, reload, say }: { ov: Overview; reload: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const s = ov.settings
  const patch = async (settings: Record<string, unknown>) => { await api('PATCH', { settings }); say('저장했어요.'); reload() }
  const learn = async () => { setBusy(true); const r = await api('POST', { action: 'learn' }); setBusy(false); say(r.ok ? `학습 완료 — 피드백 ${r.feedback}건, 품질 갱신 ${r.updated}개, 승격 ${r.promoted}개` : `실패: ${r.error}`); reload() }
  const bar = (m: Record<string, number>, label: Record<string, string>, color: string) => { const total = Object.values(m).reduce((a, b) => a + b, 0) || 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => <div key={k} className="flex items-center gap-2 text-[12px]"><span className="w-24 truncate text-[#374151]">{label[k] ?? k}</span><div className="flex-1 h-2 rounded bg-[#eef0f4] overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.round(v / total * 100)}%`, background: color }} /></div><span className="w-8 text-right tabular-nums text-[#6b7280]">{v}</span></div>) }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <StatCard label="승인된 예시" value={ov.counts.approved} sub={`전체 ${ov.counts.examples}`} accent="#2563eb" />
        <StatCard label="승인 대기" value={ov.counts.pending} accent="#f59e0b" />
        <StatCard label="규칙·가이드" value={ov.counts.rules} accent="#7c3aed" />
        <StatCard label="발화 로그 (7일)" value={ov.counts.feedback7} sub={`누적 ${ov.counts.feedback}`} accent="#059669" />
        <StatCard label="엔진" value={s.enabled ? 'ON' : 'OFF'} sub={`예시 ${s.maxExamples}개 · 규칙 ${s.maxRuleChars}자`} accent={s.enabled ? '#059669' : '#6b7280'} />
        <StatCard label="라벨링 모델" value="Haiku 4.5" sub="≈ $0.0003/건" accent="#0891b2" />
      </div>
      {/* 파이프라인 — n8n 식 노드 */}
      <Card className="p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-3">학습 파이프라인</p>
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {PIPE.map(([t, d, c], i) => (
            <div key={t} className="flex items-center gap-1.5 shrink-0">
              <div className="w-[150px] rounded-lg border border-[#e3e6ec] bg-white p-2.5"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} /><p className="text-[12px] font-bold text-[#1f2430]">{t}</p></div><p className="text-[11px] text-[#6b7280] mt-1 leading-snug">{d}</p></div>
              {i < PIPE.length - 1 && <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#c5cad4] shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 space-y-1.5"><p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">상황별 예시</p>{bar(ov.bySituation, ov.meta.situationLabel, '#2563eb')}{!Object.keys(ov.bySituation).length && <p className="text-[12px] text-[#9aa1ad]">아직 없어요 — 업로드 탭에서 시작하세요.</p>}</Card>
        <Card className="p-4 space-y-1.5"><p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">감정별 예시</p>{bar(ov.byEmotion, ov.meta.emotionLabel, '#7c3aed')}</Card>
        <Card className="p-4 space-y-1.5"><p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">장르별 예시</p>{bar(ov.byGenre, {}, '#059669')}</Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
        <Card className="p-4 space-y-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">엔진 설정</p>
          <Toggle checked={s.enabled} onChange={v => patch({ enabled: v })} label="AJ 프롬프트에 학습 데이터 주입 (끄면 페르소나 기본 말투만)" />
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>발화당 예시 수</label><input type="number" min={0} max={12} defaultValue={s.maxExamples} onBlur={e => patch({ maxExamples: Number(e.target.value) })} className={input} /></div>
            <div><label className={labelCls}>규칙 글자 예산</label><input type="number" min={200} max={4000} step={100} defaultValue={s.maxRuleChars} onBlur={e => patch({ maxRuleChars: Number(e.target.value) })} className={input} /></div>
            <div><label className={labelCls}>발화 로그 샘플링(0~1)</label><input type="number" min={0} max={1} step={0.1} defaultValue={s.logSample} onBlur={e => patch({ logSample: Number(e.target.value) })} className={input} /></div>
          </div>
          <p className="text-[11.5px] text-[#9aa1ad]">예시가 많을수록 말투가 풍부해지지만 토큰이 늘어요(예시 6개 ≈ 400토큰 ≈ ₩0.5). 규칙은 global → 장르 → 게임 순으로 예산 안에서 주입됩니다.</p>
        </Card>
        <Card className="p-4 space-y-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">학습 실행</p>
          <p className="text-[12.5px] text-[#374151] leading-relaxed">최근 30일 발화 로그의 신호(관리자 👍👎, 시청자 응답)로 사용된 예시의 품질 점수를 갱신하고, 좋은 평가를 받은 AJ 발화를 새 예시로 승격합니다. 자동화 스위치(매핑 성공 시 자동 학습)가 켜져 있으면 승격 예시가 바로 승인돼요.</p>
          <button onClick={learn} disabled={busy} className={btn.primary}>{busy ? '학습 중…' : '지금 학습 실행'}</button>
          <div className="pt-2 border-t border-[#eef0f4]"><p className="text-[11px] font-bold uppercase tracking-wide text-[#9aa1ad] mb-1.5">최근 수집</p>{ov.sources.length === 0 ? <p className="text-[12px] text-[#9aa1ad]">없음</p> : ov.sources.map(x => <div key={x.id} className="flex items-center gap-2 text-[12px] py-0.5"><Badge color={x.kind === 'transcript' ? '#e11d48' : x.kind === 'md' ? '#7c3aed' : x.kind === 'webhook' ? '#f59e0b' : '#0891b2'}>{x.kind}</Badge><span className="truncate flex-1">{x.name}</span><span className="tabular-nums text-[#6b7280]">{x.rows_imported}/{x.rows_total}</span></div>)}</div>
        </Card>
      </div>
    </div>
  )
}

function ExamplesTab({ meta, say, reload }: { meta: Meta; say: (m: string) => void; reload: () => void }) {
  const [rows, setRows] = useState<Example[] | null>(null)
  const [approved, setApproved] = useState<'all' | '1' | '0'>('0')
  const [sit, setSit] = useState(''); const [genre, setGenre] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [add, setAdd] = useState(false)
  const [f, setF] = useState({ utterance: '', situation: 'commentary', emotion: '', trigger_text: '', genre: '', tags: '' })
  const [del, setDel] = useState<Example | null>(null)
  const load = useCallback(async () => { const q = new URLSearchParams({ tab: 'examples' }); if (approved !== 'all') q.set('approved', approved); if (sit) q.set('situation', sit); if (genre) q.set('genre', genre); const r = await fetch('/api/admin/mlpilot/talk?' + q); const j = await r.json(); setRows(j.rows ?? []); setSel(new Set()) }, [approved, sit, genre])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const pager = usePager(rows ?? [], 25)
  const bulk = async (ok: boolean) => { if (!sel.size) return; await api('PATCH', { approveIds: [...sel], approved: ok }); say(ok ? `${sel.size}개 승인` : `${sel.size}개 승인 해제`); load(); reload() }
  const submit = async () => { const r = await api('POST', { action: 'addExample', example: { ...f, emotion: f.emotion || null, tags: f.tags.split(',').map(s => s.trim()).filter(Boolean) } }); if (r.ok) { say('추가했어요 (승인됨).'); setAdd(false); setF({ utterance: '', situation: 'commentary', emotion: '', trigger_text: '', genre: '', tags: '' }); load(); reload() } else say(r.error ?? '실패') }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={approved} onChange={setApproved} options={[{ value: '0', label: '승인 대기' }, { value: '1', label: '승인됨' }, { value: 'all', label: '전체' }]} />
        <select value={sit} onChange={e => setSit(e.target.value)} className={input + ' !w-auto'}><option value="">모든 상황</option>{meta.situations.map(x => <option key={x} value={x}>{meta.situationLabel[x]} ({x})</option>)}</select>
        <select value={genre} onChange={e => setGenre(e.target.value)} className={input + ' !w-auto'}><option value="">모든 장르</option>{GENRES.map(x => <option key={x} value={x}>{x}</option>)}</select>
        <div className="ml-auto flex items-center gap-2">{sel.size > 0 && <><button onClick={() => bulk(true)} className={btn.primary}>선택 {sel.size}개 승인</button><button onClick={() => bulk(false)} className={btn.ghost}>승인 해제</button></>}<button onClick={() => setAdd(true)} className={btn.primary}>예시 직접 추가</button></div>
      </div>
      <Card className="overflow-hidden">
        {rows === null ? <Skeleton rows={5} /> : rows.length === 0 ? <p className="p-6 text-[13px] text-[#9aa1ad]">조건에 맞는 예시가 없어요.</p> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}><input type="checkbox" checked={sel.size === pager.slice.length && pager.slice.length > 0} onChange={e => setSel(e.target.checked ? new Set(pager.slice.map(r => r.id)) : new Set())} /></th><th className={th}>대사</th><th className={th}>상황 / 감정</th><th className={th}>장르</th><th className={th}>출처</th><th className={`${th} text-right`}>품질</th><th className={`${th} text-right`}>사용</th><th className={th}>상태</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{pager.slice.map(r => { const [sl, sc] = SRC_LABEL[r.source] ?? [r.source, '#6b7280']; return (
              <tr key={r.id} className={trHover}>
                <td className={td}><input type="checkbox" checked={sel.has(r.id)} onChange={e => { const n = new Set(sel); if (e.target.checked) n.add(r.id); else n.delete(r.id); setSel(n) }} /></td>
                <td className={`${td} max-w-[420px]`}><p className="text-[#1f2430] font-medium leading-snug">{r.utterance}</p>{r.trigger_text && <p className="text-[11px] text-[#9aa1ad] truncate">상황: {r.trigger_text}</p>}{r.tags?.length > 0 && <p className="text-[10.5px] text-[#6b7280] truncate">{r.tags.map(t => '#' + t).join(' ')}</p>}</td>
                <td className={td}><Badge color="#2563eb">{meta.situationLabel[r.situation] ?? r.situation}</Badge>{r.emotion && <span className="ml-1"><Badge color="#7c3aed">{meta.emotionLabel[r.emotion] ?? r.emotion}</Badge></span>}</td>
                <td className={`${td} text-[#6b7280]`}>{r.genre ?? '공통'}</td>
                <td className={td}><Badge color={sc}>{sl}</Badge></td>
                <td className={`${td} text-right tabular-nums`}>{r.quality.toFixed(2)}</td>
                <td className={`${td} text-right tabular-nums`}>{r.uses}</td>
                <td className={td}>{r.approved ? <Badge color="#059669">승인</Badge> : <Badge color="#f59e0b">대기</Badge>}</td>
                <td className={td}><div className="flex gap-1.5 justify-end"><button onClick={async () => { await api('PATCH', { id: r.id, example: { approved: !r.approved } }); load(); reload() }} className={(r.approved ? btn.ghost : btn.primary) + ' !h-8 !px-2.5'}>{r.approved ? '해제' : '승인'}</button><button onClick={() => setDel(r)} className="inline-flex items-center h-8 px-2.5 rounded-md border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#dc2626] hover:text-[#dc2626]">삭제</button></div></td>
              </tr>) })}</tbody></table><Pager {...pager} /></div>
        )}
      </Card>
      <Modal open={add} onClose={() => setAdd(false)} title="예시 직접 추가" width="max-w-xl">
        <div className="space-y-3">
          <div><label className={labelCls}>대사 (AJ 가 이렇게 말하면 좋다)</label><textarea value={f.utterance} onChange={e => setF({ ...f, utterance: e.target.value })} rows={3} className={input + ' !h-auto py-2'} placeholder="예: 오 방금 콤보 봤어? 손이 안 보인다 진짜 ㅋㅋ" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>상황</label><select value={f.situation} onChange={e => setF({ ...f, situation: e.target.value })} className={input}>{meta.situations.map(x => <option key={x} value={x}>{meta.situationLabel[x]} ({x})</option>)}</select></div>
            <div><label className={labelCls}>감정 (선택)</label><select value={f.emotion} onChange={e => setF({ ...f, emotion: e.target.value })} className={input}><option value="">-</option>{meta.emotions.map(x => <option key={x} value={x}>{meta.emotionLabel[x]} ({x})</option>)}</select></div>
            <div><label className={labelCls}>장르 (선택, 비우면 공통)</label><select value={f.genre} onChange={e => setF({ ...f, genre: e.target.value })} className={input}><option value="">공통</option>{GENRES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label className={labelCls}>태그 (쉼표)</label><input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} className={input} placeholder="콤보, 칭찬" /></div>
          </div>
          <div><label className={labelCls}>이 말을 하게 된 상황/상대 말 (선택)</label><input value={f.trigger_text} onChange={e => setF({ ...f, trigger_text: e.target.value })} className={input} placeholder="예: 시청자가 5콤보를 냈을 때" /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setAdd(false)} className={btn.ghost}>취소</button><button onClick={submit} disabled={!f.utterance.trim()} className={btn.primary}>추가</button></div>
        </div>
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={async () => { await api('DELETE', { table: 'example', id: del!.id }); setDel(null); say('삭제했어요.'); load(); reload() }} title="예시 삭제" desc={<>&ldquo;{del?.utterance.slice(0, 60)}&rdquo; 를 삭제할까요?</>} />
    </div>
  )
}

function RulesTab({ meta, say, reload }: { meta: Meta; say: (m: string) => void; reload: () => void }) {
  const [rows, setRows] = useState<Rule[] | null>(null)
  const [edit, setEdit] = useState<Partial<Rule> | null>(null)
  const [del, setDel] = useState<Rule | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/mlpilot/talk?tab=rules'); const j = await r.json(); setRows(j.rows ?? []) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const save = async () => { if (!edit?.content?.trim()) return; const r = edit.id ? await api('PATCH', { id: edit.id, rule: { scope: edit.scope, genre: edit.genre || null, game_id: edit.game_id || null, kind: edit.kind, title: edit.title || null, content: edit.content, priority: edit.priority ?? 0 } }) : await api('POST', { action: 'addRule', rule: edit }); if (r.ok) { say('저장했어요.'); setEdit(null); load(); reload() } else say(r.error ?? '실패') }
  const KIND: Record<string, string> = { persona: '페르소나', empathy: '감정 이입', style: '말투/스타일', dont: '하지 말 것', scenario: '시나리오/가이드' }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-[#6b7280]">규칙은 AJ 시스템 프롬프트에 글자 예산 안에서 <b>global → 장르 → 게임</b> 순으로 주입돼요. 우선순위가 높을수록 먼저. 감정 이입 시점(&ldquo;실패 직후엔 먼저 공감, 그다음 팁&rdquo;), 하지 말 것, 장르별 말투, 게임 시나리오를 적어 두세요.</p>
        <button onClick={() => setEdit({ scope: 'global', kind: 'style', priority: 0, content: '' })} className={btn.primary}>규칙 추가</button>
      </div>
      <Card className="overflow-hidden">
        {rows === null ? <Skeleton rows={4} /> : rows.length === 0 ? <p className="p-6 text-[13px] text-[#9aa1ad]">규칙이 없어요. 예: (empathy) 시청자가 실패/죽음을 말하면 먼저 한 문장 공감 → 짧은 팁. (dont) 시청자를 깎아내리는 농담 금지.</p> : (
          <table className="w-full"><thead><tr><th className={th}>범위</th><th className={th}>종류</th><th className={th}>제목 / 내용</th><th className={`${th} text-right`}>우선순위</th><th className={th}>상태</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{rows.map(r => (
              <tr key={r.id} className={`${trHover} ${r.enabled ? '' : 'opacity-50'}`}>
                <td className={td}><Badge color={r.scope === 'global' ? '#1f2430' : r.scope === 'genre' ? '#2563eb' : '#7c3aed'}>{r.scope === 'global' ? '전체' : r.scope === 'genre' ? `장르 · ${r.genre}` : '게임'}</Badge></td>
                <td className={td}><Badge color="#6b7280">{KIND[r.kind] ?? r.kind}</Badge></td>
                <td className={`${td} max-w-[520px]`}>{r.title && <p className="font-semibold text-[#1f2430]">{r.title}</p>}<p className="text-[12.5px] text-[#374151] line-clamp-2 whitespace-pre-wrap">{r.content}</p></td>
                <td className={`${td} text-right tabular-nums`}>{r.priority}</td>
                <td className={td}><Toggle checked={r.enabled} onChange={async v => { await api('PATCH', { id: r.id, rule: { enabled: v } }); load(); reload() }} /></td>
                <td className={td}><div className="flex gap-1.5 justify-end"><button onClick={() => setEdit(r)} className={btn.ghost + ' !h-8 !px-2.5'}>편집</button><button onClick={() => setDel(r)} className="inline-flex items-center h-8 px-2.5 rounded-md border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#dc2626] hover:text-[#dc2626]">삭제</button></div></td>
              </tr>))}</tbody></table>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '규칙 편집' : '규칙 추가'} width="max-w-2xl">
        {edit && <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className={labelCls}>범위</label><select value={edit.scope} onChange={e => setEdit({ ...edit, scope: e.target.value })} className={input}><option value="global">전체</option><option value="genre">장르</option><option value="game">게임</option></select></div>
            {edit.scope === 'genre' && <div><label className={labelCls}>장르</label><select value={edit.genre ?? ''} onChange={e => setEdit({ ...edit, genre: e.target.value })} className={input}><option value="">선택</option>{GENRES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>}
            {edit.scope === 'game' && <div><label className={labelCls}>게임 ID</label><input value={edit.game_id ?? ''} onChange={e => setEdit({ ...edit, game_id: e.target.value })} className={input} placeholder="uuid" /></div>}
            <div><label className={labelCls}>종류</label><select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value })} className={input}>{meta.ruleKinds.map(k => <option key={k} value={k}>{KIND[k] ?? k}</option>)}</select></div>
            <div><label className={labelCls}>우선순위</label><input type="number" value={edit.priority ?? 0} onChange={e => setEdit({ ...edit, priority: Number(e.target.value) })} className={input} /></div>
          </div>
          <div><label className={labelCls}>제목 (선택)</label><input value={edit.title ?? ''} onChange={e => setEdit({ ...edit, title: e.target.value })} className={input} /></div>
          <div><label className={labelCls}>내용 (마크다운/자연어)</label><textarea value={edit.content ?? ''} onChange={e => setEdit({ ...edit, content: e.target.value })} rows={8} className={input + ' !h-auto py-2 font-mono text-[12px]'} placeholder={'예)\n- 시청자가 실패/죽음/아쉬움을 말하면: 먼저 한 문장 공감 → 그다음 짧은 팁.\n- 연속 성공(콤보/레벨업)에는 텐션을 올리되 같은 감탄사를 반복하지 않는다.\n- 존댓말로 말 걸면 존댓말, 반말이면 반말.'} /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className={btn.ghost}>취소</button><button onClick={save} className={btn.primary}>저장</button></div>
        </div>}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={async () => { await api('DELETE', { table: 'rule', id: del!.id }); setDel(null); say('삭제했어요.'); load(); reload() }} title="규칙 삭제" desc={<>이 규칙을 삭제할까요?</>} />
    </div>
  )
}

function UploadTab({ ov, say, reload }: { ov: Overview; say: (m: string) => void; reload: () => void }) {
  const [kind, setKind] = useState<'csv' | 'transcript' | 'md'>('csv')
  const [text, setText] = useState(''); const [name, setName] = useState(''); const [genre, setGenre] = useState(''); const [bj, setBj] = useState('')
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<string | null>(null)
  const onFile = (f: File | null) => { if (!f) return; setName(f.name); f.text().then(setText) }
  const submit = async () => { if (!text.trim()) return; setBusy(true); setResult(null); const r = await api('POST', { action: kind === 'csv' ? 'uploadCsv' : kind === 'md' ? 'uploadMd' : 'uploadTranscript', text, name: name || `${kind}-${new Date().toISOString().slice(0, 10)}`, genre: genre || null, bjName: bj || null }); setBusy(false); if (r.ok) { setResult(`완료 — ${r.imported ?? 0}건 저장${kind === 'transcript' ? ` (${r.lines}줄 라벨링)` : ''}`); say('수집 완료'); setText(''); reload() } else setResult(`실패: ${r.error}`) }
  const SAMPLE_CSV = 'situation,emotion,trigger,utterance,genre,tags\nevent_fail,empathy,시청자가 공을 놓쳐 라이프를 잃음,"아 아깝다! 괜찮아, 다음 공은 딱 각이야",action,"위로,벽돌깨기"\nevent_combo,excited,5콤보 달성,"미쳤다 5콤보!! 손이 안 보여요 지금",action,"콤보,칭찬"\nreply,funny,시청자: AJ 너 진짜 잘한다,"이 정도는 기본이지~ (사실 나도 놀람)",,"겸손,농담"\n'
  const SAMPLE_TR = '[BJ]: 자 오늘은 벽돌깨기 갑니다 여러분 준비됐죠\n[시청자]: 오늘 컨디션 어때요\n[BJ]: 컨디션? 최고지 오늘 5콤보 안 나오면 손 씻고 온다\n[BJ]: 아악 놓쳤다 아니 이걸 놓치냐 아 미안 미안\n[시청자]: ㅋㅋㅋ 괜찮아요\n[BJ]: 괜찮긴 뭐가 괜찮아 근데 고마워 다음 판은 진짜 보여준다\n'
  const dl = (fn: string, body: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' })); a.download = fn; a.click() }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
      <Card className="p-4 space-y-3">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'csv', label: 'CSV (라벨 있음)' }, { value: 'transcript', label: '인간 BJ 트랜스크립트 (AI 라벨링)' }, { value: 'md', label: 'MD 가이드 (규칙 + 예시 추출)' }]} />
        <p className="text-[12.5px] text-[#374151] leading-relaxed">
          {kind === 'csv' && <>열: <code>situation, emotion, trigger, utterance, genre, tags, quality</code> — <code>utterance</code>(또는 text)만 필수. 상황/감정 값은 아래 목록 중 하나(모르면 비워도 됨).</>}
          {kind === 'transcript' && <>실제 방송 대사를 시간순으로 붙여넣기(줄마다 <code>[화자]: 대사</code>) 또는 CSV(<code>speaker,text,event</code>). Haiku 가 BJ 대사만 골라 상황·감정·트리거를 라벨링해 예시로 저장해요(40줄당 1회 호출, 1,000줄 ≈ $0.05).</>}
          {kind === 'md' && <>말하기 가이드 문서(.md). 원문은 규칙(시나리오)으로 저장되고, 문서 속 예시 대사(없으면 지침대로 만든 예시)를 추출해 예시로 넣어요.</>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div><label className={labelCls}>파일</label><input type="file" accept={kind === 'md' ? '.md,.txt' : '.csv,.txt'} onChange={e => onFile(e.target.files?.[0] ?? null)} className="text-[12.5px]" /></div>
          <div><label className={labelCls}>이름</label><input value={name} onChange={e => setName(e.target.value)} className={input} placeholder="예: 철구 벽돌깨기 방송 3회차" /></div>
          <div><label className={labelCls}>장르 (선택)</label><select value={genre} onChange={e => setGenre(e.target.value)} className={input}><option value="">공통</option>{GENRES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
        </div>
        {kind === 'transcript' && <div><label className={labelCls}>BJ 이름 (태그용, 선택)</label><input value={bj} onChange={e => setBj(e.target.value)} className={input + ' !w-60'} /></div>}
        <div><label className={labelCls}>또는 직접 붙여넣기</label><textarea value={text} onChange={e => setText(e.target.value)} rows={12} className={input + ' !h-auto py-2 font-mono text-[12px]'} placeholder={kind === 'csv' ? SAMPLE_CSV : kind === 'transcript' ? SAMPLE_TR : '# AJ 말하기 가이드\n\n## 실패했을 때\n먼저 공감 한 문장, 그다음 짧은 팁…'} /></div>
        <div className="flex items-center gap-2"><button onClick={submit} disabled={busy || !text.trim()} className={btn.primary}>{busy ? (kind === 'csv' ? '저장 중…' : 'AI 라벨링 중…') : '수집 실행'}</button><button onClick={() => dl(kind === 'transcript' ? 'transcript-sample.txt' : 'aj-talk-sample.csv', kind === 'transcript' ? SAMPLE_TR : SAMPLE_CSV)} className={btn.ghost}>샘플 다운로드</button>{result && <span className="text-[12.5px] text-[#374151]">{result}</span>}</div>
      </Card>
      <Card className="p-4 space-y-2">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">라벨 값</p>
        <p className="text-[11px] font-bold text-[#9aa1ad] uppercase">situation</p>
        <div className="flex flex-wrap gap-1">{ov.meta.situations.map(s => <span key={s} className="rounded bg-[#eef2ff] text-[#2563eb] px-1.5 py-0.5 text-[11px] font-semibold" title={ov.meta.situationLabel[s]}>{s}</span>)}</div>
        <p className="text-[11px] font-bold text-[#9aa1ad] uppercase mt-2">emotion</p>
        <div className="flex flex-wrap gap-1">{ov.meta.emotions.map(s => <span key={s} className="rounded bg-[#f3e8ff] text-[#7c3aed] px-1.5 py-0.5 text-[11px] font-semibold" title={ov.meta.emotionLabel[s]}>{s}</span>)}</div>
        <p className="text-[11.5px] text-[#6b7280] pt-2 leading-relaxed">수집된 예시는 자동화 스위치(MLPilot · 자동 학습)가 켜져 있으면 바로 승인, 꺼져 있으면 &ldquo;예시&rdquo; 탭에서 승인 후 AJ 가 사용해요. 소스 단위 삭제는 개요의 최근 수집에서.</p>
      </Card>
    </div>
  )
}

function ConnectTab({ ov, say, reload }: { ov: Overview; say: (m: string) => void; reload: () => void }) {
  const [key, setKey] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vibrexcup.com'
  const rotate = async () => { const r = await api('POST', { action: 'rotateKey' }); if (r.ok) { setKey(r.key as string); say('새 키를 발급했어요 — 지금만 전체가 보여요.'); reload() } }
  const ex = (body: string) => `curl -X POST ${origin}/api/mlpilot/ingest \\\n  -H "x-mlpilot-key: ${key ?? '<키>'}" -H "Content-Type: application/json" \\\n  -d '${body}'`
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card className="p-4 space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">웹훅 (n8n · Make · Zapier · 스크립트)</p>
        <p className="text-[12.5px] text-[#374151] leading-relaxed">외부 자동화에서 방송 대사·예시·규칙을 밀어 넣는 엔드포인트예요. n8n 에선 HTTP Request 노드 → POST, Header <code>x-mlpilot-key</code>.</p>
        <div className="rounded-md border border-[#e3e6ec] bg-[#f8f9fb] px-3 py-2 text-[12.5px] font-mono break-all">POST {origin}/api/mlpilot/ingest</div>
        <div className="flex items-center gap-2"><span className="text-[12.5px] text-[#6b7280]">키: {key ?? (ov.settings.hasKey ? ov.settings.ingestKey : '없음')}</span><button onClick={rotate} className={btn.ghost}>{ov.settings.hasKey ? '키 재발급' : '키 발급'}</button></div>
        <p className="text-[11.5px] text-[#9aa1ad]">재발급하면 이전 키는 즉시 무효. 키는 발급 직후 한 번만 전체가 보이니 바로 n8n 에 넣어 두세요.</p>
      </Card>
      <Card className="p-4 space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">요청 예시</p>
        <p className="text-[11.5px] font-bold text-[#9aa1ad]">1) 라벨된 예시</p><pre className="rounded-md bg-[#0f1117] text-[#e5e7eb] text-[11px] p-3 overflow-x-auto whitespace-pre">{ex('{"examples":[{"utterance":"아 아깝다! 다음 공은 각이야","situation":"event_fail","emotion":"empathy","genre":"action"}]}')}</pre>
        <p className="text-[11.5px] font-bold text-[#9aa1ad]">2) 인간 BJ 트랜스크립트 (AI 라벨링)</p><pre className="rounded-md bg-[#0f1117] text-[#e5e7eb] text-[11px] p-3 overflow-x-auto whitespace-pre">{ex('{"name":"철구 3회차","genre":"action","bjName":"철구","transcript":[{"speaker":"BJ","text":"자 갑니다"},{"speaker":"viewer","text":"화이팅"},{"speaker":"BJ","text":"아 놓쳤다 미안 다음판 보여줄게"}]}')}</pre>
        <p className="text-[11.5px] font-bold text-[#9aa1ad]">3) 규칙</p><pre className="rounded-md bg-[#0f1117] text-[#e5e7eb] text-[11px] p-3 overflow-x-auto whitespace-pre">{ex('{"rule":{"scope":"genre","genre":"action","kind":"empathy","content":"실패 직후엔 먼저 공감 한 문장, 그다음 팁"}}')}</pre>
      </Card>
    </div>
  )
}

function FeedbackTab({ meta, say }: { meta: Meta; say: (m: string) => void }) {
  const [rows, setRows] = useState<Feedback[] | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/mlpilot/talk?tab=feedback'); const j = await r.json(); setRows(j.rows ?? []) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const pager = usePager(rows ?? [], 25)
  const rate = async (id: string, v: number) => { await api('PATCH', { feedbackId: id, rating: v }); setRows(rs => (rs ?? []).map(r => r.id === id ? { ...r, rating: v } : r)); say(v > 0 ? '👍 좋은 발화로 표시' : '👎 나쁜 발화로 표시') }
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#e3e6ec] flex items-center justify-between"><span className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">AJ 실제 발화 로그</span><span className="text-[12px] text-[#6b7280]">👍/👎 로 평가하면 &ldquo;학습 실행&rdquo; 때 사용된 예시 품질에 반영되고, 👍 발화는 새 예시로 승격돼요.</span></div>
      {rows === null ? <Skeleton rows={5} /> : rows.length === 0 ? <p className="p-6 text-[13px] text-[#9aa1ad]">아직 로그가 없어요 (엔진 설정의 샘플링 비율만큼 기록돼요).</p> : (
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr><th className={th}>시각</th><th className={th}>상황</th><th className={th}>시청자 말</th><th className={th}>AJ 발화</th><th className={`${th} text-right`}>예시</th><th className={th}>평가</th></tr></thead>
          <tbody className="divide-y divide-[#eef0f4]">{pager.slice.map(r => (
            <tr key={r.id} className={trHover}>
              <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(r.created_at).toLocaleString()}</td>
              <td className={td}><Badge color="#2563eb">{meta.situationLabel[r.situation] ?? r.situation}</Badge>{r.emotion && <span className="ml-1"><Badge color="#7c3aed">{meta.emotionLabel[r.emotion] ?? r.emotion}</Badge></span>}<p className="text-[10.5px] text-[#9aa1ad]">{r.genre}</p></td>
              <td className={`${td} max-w-[240px] text-[#6b7280]`}><p className="truncate" title={r.viewer_text ?? ''}>{r.viewer_text ?? '-'}</p></td>
              <td className={`${td} max-w-[420px]`}><p className="font-medium text-[#1f2430]">{r.utterance}</p></td>
              <td className={`${td} text-right tabular-nums text-[#6b7280]`}>{r.example_ids?.length ?? 0}</td>
              <td className={td}><div className="flex gap-1"><button onClick={() => rate(r.id, 1)} className={`h-7 px-2 rounded-md border text-[12px] ${r.rating === 1 ? 'bg-[#059669] text-white border-[#059669]' : 'border-[#e3e6ec] hover:border-[#059669]'}`}>👍</button><button onClick={() => rate(r.id, -1)} className={`h-7 px-2 rounded-md border text-[12px] ${r.rating === -1 ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'border-[#e3e6ec] hover:border-[#dc2626]'}`}>👎</button></div></td>
            </tr>))}</tbody></table><Pager {...pager} /></div>
      )}
    </Card>
  )
}

function CurriculumTab({ say }: { say: (m: string) => void }) {
  interface CurRow { id: string; template_key: string; game_id: string | null; step_order: number; name: string; hint: string; enabled: boolean }
  const [rows, setRows] = useState<CurRow[] | null>(null)
  const [builtin, setBuiltin] = useState<Record<string, string[]>>({})
  const [f, setF] = useState({ template_key: 'tetris', name: '', hint: '', step_order: 100 })
  const load = useCallback(async () => { const r = await fetch('/api/admin/mlpilot/talk?tab=curriculum'); const j = await r.json(); setRows(j.rows ?? []); setBuiltin(j.builtin ?? {}) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const KEYS = [...Object.keys(builtin), 'genre:action', 'genre:sports', 'genre:adventure', 'genre:strategy']
  const add = async () => { const r = await api('POST', { action: 'addSkill', skill: f }); if (r.ok) { say('추가했어요.'); setF({ ...f, name: '', hint: '' }); load() } else say(r.error ?? '실패') }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#e3e6ec] text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">봇 기본기 커리큘럼 — 템플릿이 보유한 정석 지식</div>
        <p className="px-4 pt-3 text-[12.5px] text-[#6b7280]">내장 단계(코드) 뒤에 여기서 추가한 단계가 심화 과정으로 이어져요. 회원별 AJ 는 2판 + 1시간 간격으로 한 단계씩 배웁니다. 제작자가 자기 게임에 등록한 가이드(game:*)도 여기 보여요.</p>
        <div className="p-4 space-y-3">
          {Object.entries(builtin).map(([k, names]) => (
            <div key={k}>
              <p className="text-[12px] font-bold text-[#1f2430]">{k} <span className="text-[#9aa1ad] font-normal">내장 {names.length}단계</span></p>
              <p className="text-[11.5px] text-[#6b7280]">{names.map((n, i) => `${i + 1}.${n}`).join(' → ')}</p>
              {(rows ?? []).filter(r => r.template_key === k).map((r, i) => (
                <div key={r.id} className={`mt-1 flex items-start gap-2 text-[12px] ${r.enabled ? '' : 'opacity-50'}`}><Badge color="#7c3aed">추가 {names.length + i + 1}단계</Badge><span className="flex-1"><b>{r.name}</b> — {r.hint}</span>
                  <button onClick={async () => { await api('POST', { action: 'toggleSkill', id: r.id, enabled: !r.enabled }); load() }} className={btn.ghost + ' !h-6 !px-2 !text-[11px]'}>{r.enabled ? '끄기' : '켜기'}</button>
                  <button onClick={async () => { await api('POST', { action: 'deleteSkill', id: r.id }); load() }} className="text-[#dc2626] text-[11px] font-semibold">삭제</button></div>
              ))}
            </div>
          ))}
          {(rows ?? []).filter(r => !builtin[r.template_key]).length > 0 && (
            <div className="pt-2 border-t border-[#eef0f4]">
              <p className="text-[12px] font-bold text-[#1f2430] mb-1">기타 (장르 폴백 · 제작자 게임 가이드)</p>
              {(rows ?? []).filter(r => !builtin[r.template_key]).map(r => (
                <div key={r.id} className={`mt-1 flex items-start gap-2 text-[12px] ${r.enabled ? '' : 'opacity-50'}`}><Badge color={r.game_id ? '#059669' : '#0891b2'}>{r.template_key}</Badge><span className="flex-1"><b>{r.name}</b> — {r.hint}</span>
                  <button onClick={async () => { await api('POST', { action: 'toggleSkill', id: r.id, enabled: !r.enabled }); load() }} className={btn.ghost + ' !h-6 !px-2 !text-[11px]'}>{r.enabled ? '끄기' : '켜기'}</button>
                  <button onClick={async () => { await api('POST', { action: 'deleteSkill', id: r.id }); load() }} className="text-[#dc2626] text-[11px] font-semibold">삭제</button></div>
              ))}
            </div>
          )}
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">단계 추가</p>
        <div><label className={labelCls}>템플릿 / 장르</label><select value={f.template_key} onChange={e => setF({ ...f, template_key: e.target.value })} className={input}>{KEYS.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
        <div><label className={labelCls}>단계 이름</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={input} placeholder="예: T-스핀 준비" /></div>
        <div><label className={labelCls}>가르칠 내용 (자연어 — AI 가 게임 상태에 맞는 규칙으로 컴파일)</label><textarea value={f.hint} onChange={e => setF({ ...f, hint: e.target.value })} rows={5} className={input + ' !h-auto py-2'} placeholder="예: L/J 블록으로 한 칸 파인 홈을 만들어 두고 T 블록이 오면 회전해 끼워 넣어 보너스를 노려." /></div>
        <div><label className={labelCls}>순서 (큰 수가 나중)</label><input type="number" value={f.step_order} onChange={e => setF({ ...f, step_order: Number(e.target.value) })} className={input + ' !w-28'} /></div>
        <button onClick={add} disabled={!f.name.trim() || !f.hint.trim()} className={btn.primary}>추가</button>
      </Card>
    </div>
  )
}
