'use client'
// 사람 체크(AI 대시보드) — AI/자동화가 대신 처리한 내역, 사람이 봐야 할 대기 항목, 오류. 모바일/태블릿에서도 한눈에.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader, Card, Badge, Segmented, Skeleton, Toggle, Toast, btn } from '@/components/admin/ui'
import { AutoDot } from '@/components/admin/AutoStatusDot'

interface Log { id: string; module: string; action: string; target: string | null; status: 'ok' | 'error' | 'needs_review'; detail: Record<string, unknown> | null; reviewed_at: string | null; created_at: string }
interface Mod { key: string; menu: string; label: string; desc: string }
interface Data { flags: Record<string, boolean>; health: Record<string, { state: 'on' | 'off' | 'error'; errors: number; review: number }>; modules: Mod[]; logs: Log[]; logsMissing?: boolean; pending: { templates: number; refunds: number; failedPayments: number; openErrors: number; securityHigh: number; review: number; errors: number } }
const MODULE_LABEL: Record<string, [string, string]> = { templates: ['템플릿', '/admin/templates'], mlpilot: ['MLPilot', '/admin/mlpilot'], tokenpilot: ['TokenPilot', '/admin/costs'], adpilot: ['AdPilot', '/admin/ads'], blog: ['블로그', '/admin/blog'], aj: ['AJ', '/admin/aj'], payments: ['결제', '/admin/payments'], broadcasts: ['방송', '/admin/broadcasts'], security: ['보안', '/admin/security'] }
const rel = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.round(h / 24)}일 전` }

export default function OpsBoard({ standalone = false }: { standalone?: boolean }) {
  const [d, setD] = useState<Data | null>(null)
  const [filter, setFilter] = useState<'all' | 'review' | 'error' | 'ok'>('all')
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = useCallback(async () => { const r = await fetch('/api/admin/automation?full=1'); if (r.ok) setD(await r.json()) }, [])
  useEffect(() => { const t = setTimeout(load, 0); const iv = setInterval(load, 45_000); return () => { clearTimeout(t); clearInterval(iv) } }, [load])
  const patch = async (b: Record<string, unknown>) => { await fetch('/api/admin/automation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); load() }
  const header = standalone ? <div className="mb-3 flex items-end justify-between gap-2"><div><h1 className="text-[18px] md:text-[22px] font-extrabold tracking-tight text-[#1f2430]">AI 대시보드</h1><p className="text-[12px] md:text-[13px] text-[#6b7280]">AI 가 대신 처리한 것 · 사람이 봐야 할 것 · 오류</p></div><button onClick={load} className={btn.ghost}>새로고침</button></div> : <PageHeader title="사람 체크" desc="AI·자동화가 관리자 대신 처리한 내역과, 사람이 직접 봐야 할 항목을 모아 보여줘요. 각 메뉴의 AI 를 여기서 켜고 끌 수 있고, 오류가 난 메뉴는 초기화로 정상화합니다." actions={<button onClick={load} className={btn.ghost}>새로고침</button>} />
  if (!d) return <div>{header}<Skeleton rows={6} /></div>
  const logs = d.logs.filter(l => filter === 'all' || (filter === 'review' ? l.status === 'needs_review' && !l.reviewed_at : filter === 'error' ? l.status === 'error' && !l.reviewed_at : l.status === 'ok'))
  const groups = Object.entries(d.modules.reduce<Record<string, Mod[]>>((a, m) => { const mod = m.key.split('.')[0]; (a[mod] ??= []).push(m); return a }, {}))
  return (
    <div>
      {header}
      {d.logsMissing && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">처리 내역 테이블이 없어요. <code>db/migrations/2026-08-19-automation.sql</code> 을 실행하면 AI 처리 내역이 쌓입니다. (스위치는 동작해요)</p>}
      {/* 사람이 봐야 할 것 — 모바일 2열 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-4">
        {[['검토 대기', d.pending.review, '/admin-ops', '#f59e0b'], ['AI 오류', d.pending.errors, '/admin-ops', '#dc2626'], ['템플릿 승인 대기', d.pending.templates, '/admin/templates', '#7c3aed'], ['환불 검토', d.pending.refunds, '/admin/payments', '#f59e0b'], ['결제 실패(24h)', d.pending.failedPayments, '/admin/payments', '#dc2626'], ['미해결 에러(24h)', d.pending.openErrors, '/admin/logs', '#dc2626'], ['보안 HIGH(24h)', d.pending.securityHigh, '/admin/security', '#dc2626']].map(([l, v, href, c]) => (
          <Link key={l as string} href={href as string} className="rounded-lg border border-[#e3e6ec] bg-white px-3.5 py-3 hover:border-[#c5cad4]"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">{l}</p><p className="text-[22px] font-bold leading-none mt-1.5" style={{ color: (v as number) > 0 ? (c as string) : '#1f2430' }}>{v as number}</p></Link>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-3">
        {/* 메뉴별 AI 스위치 */}
        <Card className="overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#e3e6ec] text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">메뉴별 AI 자동 처리</div>
          <ul className="divide-y divide-[#eef0f4]">{groups.map(([mod, mods]) => { const h = d.health[mod] ?? { state: 'off', errors: 0, review: 0 }; const [label, href] = MODULE_LABEL[mod] ?? [mod, '/admin']; return (
            <li key={mod} className="px-4 py-3">
              <div className="flex items-center gap-2"><AutoDot state={h.state} size={9} /><Link href={href} className="text-[13px] font-bold text-[#1f2430] hover:text-[#2563eb]">{label}</Link>{h.state === 'error' && <Badge color="#dc2626">오류 {h.errors}</Badge>}{h.review > 0 && <Badge color="#f59e0b">검토 {h.review}</Badge>}
                {(h.state === 'error' || h.review > 0) && <button onClick={() => patch({ resetModule: mod }).then(() => say(`${label} 초기화 완료`))} className="ml-auto text-[11.5px] font-semibold text-[#dc2626] hover:underline">초기화</button>}</div>
              <div className="mt-2 space-y-1.5">{mods.map(m => <div key={m.key} className="flex items-start gap-2"><Toggle checked={!!d.flags[m.key]} onChange={v => patch({ flags: { [m.key]: v } }).then(() => say(v ? 'AI 자동 처리 켬' : '수동 처리로 전환'))} /><span className="text-[12px] text-[#374151] leading-snug">{m.label}<span className="text-[#9aa1ad]"> · {m.desc}</span></span></div>)}</div>
            </li>) })}</ul>
        </Card>
        {/* 처리 내역 */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#e3e6ec]"><span className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">AI 처리 내역</span><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: '전체' }, { value: 'review', label: '검토 대기' }, { value: 'error', label: '오류' }, { value: 'ok', label: '정상' }]} /></div>
          {logs.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">내역이 없어요.</p> : (
            <ul className="divide-y divide-[#eef0f4] max-h-[70vh] overflow-y-auto">{logs.map(l => { const [label, href] = MODULE_LABEL[l.module] ?? [l.module, '/admin']; return (
              <li key={l.id} className={`px-4 py-3 ${l.reviewed_at ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap"><Badge color={l.status === 'ok' ? '#059669' : l.status === 'error' ? '#dc2626' : '#f59e0b'}>{l.status === 'ok' ? '처리됨' : l.status === 'error' ? '오류' : '검토 필요'}</Badge><Link href={href} className="text-[11.5px] font-semibold text-[#2563eb]">{label}</Link><span className="ml-auto text-[11px] text-[#9aa1ad]">{rel(l.created_at)}</span></div>
                <p className="mt-1 text-[13px] text-[#1f2430]">{l.action}{l.target ? <span className="text-[#6b7280]"> · {l.target}</span> : null}</p>
                {l.detail && <p className="text-[11px] text-[#9aa1ad] truncate">{JSON.stringify(l.detail)}</p>}
                {!l.reviewed_at && l.status !== 'ok' && <button onClick={() => patch({ reviewId: l.id })} className="mt-1 text-[11.5px] font-semibold text-[#059669] hover:underline">확인 처리</button>}
              </li>) })}</ul>
          )}
        </Card>
      </div>
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
