'use client'
// 결제 관리 (Paddle) — 매출·환불 통계, 결제 내역, 환불 요청/수동 처리, 이벤트 타임라인, Paddle 동기화
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, Badge, Modal, Toast, Skeleton, EmptyState, Segmented, Avatar, btn, input, label as labelCls, th, td, trHover } from '@/components/admin/ui'

interface PayRow {
  id: string; user_id: string | null; status: string; amount_minor: number | null; currency: string | null; credits: number; pack_key: string | null
  customer_email: string | null; invoice_number: string | null; payment_method: string | null; card_brand: string | null; card_last4: string | null; country: string | null
  refunded_minor: number; refund_reason: string | null; refunded_at: string | null; credits_revoked: boolean; billed_at: string | null; created_at: string; dashboard_url: string
  profiles: { username: string | null; agent_name: string | null; avatar_config: { previewUrl?: string } | null } | null
}
interface Data {
  days: number; currency: string; configured: boolean; env: string
  totals: { count: number; completed: number; refunded: number; gross: number; refundedMinor: number; net: number; credits: number; buyers: number; unknownAmount: number }
  byDay: { day: string; gross: number; count: number; refunded: number }[]
  byPack: Record<string, { count: number; gross: number; credits: number }>
  rows: PayRow[]
}
interface Ev { id: string; event_type: string; created_at: string; processed: boolean; error: string | null; payload: Record<string, unknown> }

const STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: '결제 완료', color: '#059669' }, refund_pending: { label: '환불 검토 중', color: '#f59e0b' }, refunded: { label: '환불됨', color: '#e11d48' },
  partially_refunded: { label: '부분 환불', color: '#db2777' }, chargeback: { label: '차지백', color: '#7c3aed' }, canceled: { label: '취소', color: '#857a68' }, failed: { label: '실패', color: '#857a68' },
}
const PACK: Record<string, string> = { small: 'Small · 100', medium: 'Medium · 450', large: 'Large · 1,250' }
const money = (minor: number | null | undefined, cur: string | null | undefined) => {
  if (minor == null) return '—'
  const c = cur ?? 'USD'; const zero = ['KRW', 'JPY'].includes(c)
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: c, minimumFractionDigits: zero ? 0 : 2 }).format(zero ? minor : minor / 100)
}
type Filter = 'all' | 'completed' | 'refunded' | 'pending'

export default function AdminPaymentsPage() {
  const [days, setDays] = useState(30)
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null; missing?: boolean }>({ days: 0, data: null, err: null })
  const data = state.days === days ? state.data : null
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<PayRow | null>(null)
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [refunding, setRefunding] = useState<PayRow | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const supabase = createClient()
  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200) }

  const load = useCallback(async (d: number) => {
    const r = await fetch(`/api/admin/payments?days=${d}`); const j = await r.json()
    if (!r.ok) setState({ days: d, data: null, err: j.error ?? String(r.status), missing: !!j.missing }); else setState({ days: d, data: j, err: null })
  }, [])
  useEffect(() => { const t = setTimeout(() => load(days), 0); return () => clearTimeout(t) }, [days, load])

  const openDetail = async (p: PayRow) => {
    setDetail(p); setEvents(null)
    const { data: ev } = await supabase.from('payment_events').select('id,event_type,created_at,processed,error,payload').eq('transaction_id', p.id).order('created_at', { ascending: false })
    setEvents((ev as Ev[] | null) ?? [])
  }
  const act = async (action: string, id?: string, extra?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? '실패')
      await load(days); return j
    } catch (e) { say(e instanceof Error ? e.message : '실패', 'err'); return null } finally { setBusy(false) }
  }

  const rows = useMemo(() => (data?.rows ?? []).filter(r =>
    (filter === 'all' || (filter === 'completed' && r.status === 'completed') || (filter === 'refunded' && ['refunded', 'partially_refunded', 'chargeback'].includes(r.status)) || (filter === 'pending' && r.status === 'refund_pending')) &&
    (!query.trim() || [r.id, r.customer_email, r.invoice_number, r.profiles?.username, r.profiles?.agent_name].some(v => v?.toLowerCase().includes(query.trim().toLowerCase())))
  ), [data, filter, query])

  const header = (
    <PageHeader title="결제 관리" desc={<>PG: <b>Paddle</b> (Merchant of Record — 카드·PayPal·현지 결제·세금 처리 대행) · 환경 <span className="font-mono">{data?.env ?? '…'}</span></>}
      actions={<>
        <Segmented value={days} onChange={setDays} options={[7, 30, 90, 365].map(d => ({ value: d, label: `${d}일` }))} />
        <button onClick={async () => { const j = await act('sync'); if (j) say(`Paddle 에서 ${j.synced}건 동기화했어요.`) }} disabled={busy} className={btn.ghost} title="Paddle 트랜잭션을 불러와 금액·이메일·카드 정보를 채우고 누락 결제를 복구해요">Paddle 동기화</button>
      </>} />
  )

  if (state.days === days && state.err) return (
    <div>{header}
      <Card className="p-6">
        <p className="text-[14px] font-semibold text-[#241f17]">{state.missing ? '결제 테이블이 아직 없어요' : '불러오지 못했어요'}</p>
        <p className="text-[13px] text-[#857a68] mt-1">{state.missing ? <>Supabase SQL Editor 에서 <code>db/migrations/2026-08-18-payments.sql</code> 을 실행하세요. 기존 구매 기록(credit_ledger)은 자동으로 백필돼요.</> : state.err}</p>
      </Card>
    </div>
  )
  if (!data) return <div>{header}<Skeleton rows={6} /></div>
  const t = data.totals; const cur = data.currency
  const refundRate = t.count ? Math.round((t.refunded / t.count) * 100) : 0

  return (
    <div className="space-y-6">
      {header}
      {!data.configured && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">
          <b>PADDLE_API_KEY</b> 가 없어 결제 금액·카드 정보 자동 채움, API 환불 요청, 동기화가 꺼져 있어요. Paddle 대시보드 → Developer Tools → Authentication 에서 API 키를 만들어 Vercel 환경변수 <code>PADDLE_API_KEY</code> 로 추가하면 켜져요. 그 전까지는 웹훅으로 들어오는 새 결제만 금액이 기록되고, 환불은 Paddle 에서 처리 후 여기서 <b>수동 환불 처리</b>로 반영하세요.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="총 매출" value={money(t.gross, cur)} sub={`${t.count}건 · 구매자 ${t.buyers}명${t.unknownAmount ? ` · 금액 미상 ${t.unknownAmount}건` : ''}`} />
        <StatCard label="환불액" value={money(t.refundedMinor, cur)} sub={`${t.refunded}건 · 환불율 ${refundRate}%`} accent="#e11d48" />
        <StatCard label="순매출" value={money(t.net, cur)} sub="총 매출 − 환불 (Paddle 수수료 제외)" accent="#059669" />
        <StatCard label="지급 크레딧" value={t.credits} sub={t.count ? `건당 평균 ${Math.round(t.credits / t.count)}` : '-'} accent="#0891b2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TrendChart label={`일별 매출 (${cur})`} sub={`최근 ${data.days}일`} values={data.byDay.map(d => d.gross)} labels={data.byDay.map(d => d.day.slice(5))} format={v => money(v, cur)} />
        <TrendChart label="일별 결제 건수" sub={`최근 ${data.days}일`} values={data.byDay.map(d => d.count)} labels={data.byDay.map(d => d.day.slice(5))} color="#0891b2" />
        <Card className="p-5">
          <p className="text-[12px] font-semibold text-[#857a68] mb-3">팩별 판매</p>
          <ul className="space-y-2.5">
            {Object.entries(data.byPack).sort((a, b) => b[1].gross - a[1].gross).map(([k, v]) => {
              const share = t.count ? Math.round((v.count / t.count) * 100) : 0
              return (
                <li key={k}>
                  <div className="flex items-center justify-between text-[13px]"><span className="font-semibold text-[#241f17]">{PACK[k] ?? k}</span><span className="text-[#4a4337] tabular-nums">{v.count}건 · {money(v.gross, cur)}</span></div>
                  <div className="h-1.5 rounded-full bg-[#f1ece2] mt-1"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${share}%` }} /></div>
                </li>
              )
            })}
            {Object.keys(data.byPack).length === 0 && <li className="text-[13px] text-[#9d9280]">아직 결제가 없어요.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap p-4 border-b border-[#ebe4d6]">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="이메일 · 회원 · 트랜잭션/인보이스 번호" className={`${input} max-w-sm`} />
          <div className="ml-auto"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: `전체 ${data.rows.length}` }, { value: 'completed', label: '완료' }, { value: 'pending', label: '환불 검토' }, { value: 'refunded', label: '환불/차지백' }]} /></div>
        </div>
        {rows.length === 0 ? <EmptyState icon="💳" title="결제 내역이 없어요" desc="기간을 늘리거나 Paddle 동기화를 실행해 보세요." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>일시</th><th className={th}>회원</th><th className={th}>상품</th><th className={`${th} text-right`}>금액</th><th className={th}>결제수단</th><th className={th}>상태</th><th className={th}>Paddle</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-[#f0eadf]">
                {rows.map(r => {
                  const st = STATUS[r.status] ?? { label: r.status, color: '#857a68' }
                  return (
                    <tr key={r.id} className={`${trHover} cursor-pointer`} onClick={() => openDetail(r)}>
                      <td className={`${td} whitespace-nowrap`}><p className="text-[#241f17]">{new Date(r.billed_at ?? r.created_at).toLocaleDateString()}</p><p className="text-[11px] text-[#9d9280]">{new Date(r.billed_at ?? r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></td>
                      <td className={td}>
                        <div className="flex items-center gap-2.5 min-w-[180px]">
                          <Avatar url={r.profiles?.avatar_config?.previewUrl} name={r.profiles?.username || r.customer_email || '?'} size={30} />
                          <div className="min-w-0"><p className="font-semibold text-[#241f17] truncate">{r.profiles?.agent_name ?? r.profiles?.username ?? '(회원 미매핑)'}</p><p className="text-[11.5px] text-[#9d9280] truncate">{r.customer_email ?? r.user_id?.slice(0, 8) ?? '-'}</p></div>
                        </div>
                      </td>
                      <td className={td}><p className="text-[#241f17]">{PACK[r.pack_key ?? ''] ?? (r.pack_key ?? '크레딧')}</p><p className="text-[11.5px] text-[#9d9280]">+{r.credits.toLocaleString()} 크레딧{r.credits_revoked ? ' · 회수됨' : ''}</p></td>
                      <td className={`${td} text-right tabular-nums`}><p className="font-semibold text-[#241f17]">{money(r.amount_minor, r.currency)}</p>{r.refunded_minor > 0 && <p className="text-[11px] text-[#e11d48]">−{money(r.refunded_minor, r.currency)}</p>}</td>
                      <td className={`${td} whitespace-nowrap`}>{r.payment_method ? <span className="capitalize">{r.card_brand ?? r.payment_method}{r.card_last4 ? ` ••${r.card_last4}` : ''}</span> : <span className="text-[#c4b9a2]">—</span>}</td>
                      <td className={td}><Badge color={st.color}>{st.label}</Badge></td>
                      <td className={td}><a href={r.dashboard_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="font-mono text-[11px] text-[#2563eb] hover:underline">{r.id.slice(0, 12)}…</a>{r.invoice_number && <p className="text-[11px] text-[#9d9280]">{r.invoice_number}</p>}</td>
                      <td className={td} onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end">
                          {r.status === 'completed' && <button onClick={() => { setRefunding(r); setReason('') }} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#ebe4d6] text-[12.5px] font-medium text-[#857a68] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">환불</button>}
                          <button onClick={() => openDetail(r)} className={btn.ghost + ' !h-8 !px-2.5'}>상세</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 환불 모달 */}
      <Modal open={!!refunding} onClose={() => setRefunding(null)} title="환불 처리">
        {refunding && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#faf8f3] p-4 text-[13px] text-[#4a4337]">
              <p><b>{refunding.profiles?.agent_name ?? refunding.profiles?.username ?? refunding.customer_email}</b> · {PACK[refunding.pack_key ?? ''] ?? '크레딧'} · <b>{money(refunding.amount_minor, refunding.currency)}</b></p>
              <p className="text-[12px] text-[#857a68] mt-1">환불되면 지급한 <b>{refunding.credits}</b> 크레딧을 자동 회수해요 (이미 써서 잔액이 부족하면 마이너스로 기록).</p>
            </div>
            <div><label className={labelCls}>사유</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 고객 요청 / 중복 결제 / 서비스 불만" className={input} autoFocus /></div>
            <div className="grid gap-2">
              <button disabled={busy || !data.configured} onClick={async () => { const j = await act('refund', refunding.id, { reason }); if (j) { say('Paddle 에 환불 요청을 보냈어요. Paddle 승인 후 자동 반영돼요.'); setRefunding(null) } }} className={btn.danger + ' justify-center'} title={data.configured ? '' : 'PADDLE_API_KEY 필요'}>Paddle 에 전액 환불 요청{!data.configured && ' (API 키 필요)'}</button>
              <button disabled={busy} onClick={async () => { const j = await act('mark_refunded', refunding.id, { reason }); if (j) { say('환불 처리하고 크레딧을 회수했어요.'); setRefunding(null) } }} className={btn.ghost + ' justify-center'}>Paddle 에서 이미 환불함 → 수동 환불 처리</button>
              <a href={refunding.dashboard_url} target="_blank" rel="noreferrer" className="text-center text-[12.5px] text-[#2563eb] hover:underline">Paddle 대시보드에서 이 결제 열기 →</a>
            </div>
          </div>
        )}
      </Modal>

      {/* 상세 드로어 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="결제 상세" width="max-w-lg">
        {detail && (
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[['트랜잭션', <a key="a" href={detail.dashboard_url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-[#2563eb] hover:underline break-all">{detail.id}</a>],
                ['상태', <Badge key="b" color={(STATUS[detail.status] ?? { color: '#857a68' }).color}>{(STATUS[detail.status] ?? { label: detail.status }).label}</Badge>],
                ['회원', `${detail.profiles?.agent_name ?? detail.profiles?.username ?? '(미매핑)'}`], ['이메일', detail.customer_email ?? '—'],
                ['상품', PACK[detail.pack_key ?? ''] ?? '크레딧'], ['크레딧', `+${detail.credits}${detail.credits_revoked ? ' (회수됨)' : ''}`],
                ['금액', money(detail.amount_minor, detail.currency)], ['환불액', detail.refunded_minor ? money(detail.refunded_minor, detail.currency) : '—'],
                ['결제수단', detail.payment_method ? `${detail.card_brand ?? detail.payment_method}${detail.card_last4 ? ` ••${detail.card_last4}` : ''}` : '—'], ['인보이스', detail.invoice_number ?? '—'],
                ['결제 일시', new Date(detail.billed_at ?? detail.created_at).toLocaleString()], ['환불 일시', detail.refunded_at ? new Date(detail.refunded_at).toLocaleString() : '—'],
                ['환불 사유', detail.refund_reason ?? '—'], ['국가', detail.country ?? '—'],
              ].map(([k, v], i) => <div key={i}><p className="text-[11px] font-semibold text-[#9d9280]">{k as string}</p><div className="text-[#241f17] mt-0.5">{v as React.ReactNode}</div></div>)}
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.configured && <button disabled={busy} onClick={async () => { const j = await act('sync_one', detail.id); if (j) say('Paddle 에서 최신 정보를 가져왔어요.') }} className={btn.ghost + ' !h-8'}>Paddle 에서 새로고침</button>}
              {(detail.status === 'refunded' || detail.status === 'chargeback') && <button disabled={busy} onClick={async () => { if (!confirm('환불 상태를 취소하고 회수한 크레딧을 다시 지급할까요?')) return; const j = await act('unrefund', detail.id); if (j) { say('환불을 철회했어요.'); setDetail(null) } }} className={btn.ghost + ' !h-8'}>환불 철회 (크레딧 재지급)</button>}
            </div>
            <div>
              <p className="text-[12px] font-bold text-[#241f17] mb-2">이벤트 타임라인</p>
              {events === null ? <Skeleton rows={2} /> : events.length === 0 ? <p className="text-[12px] text-[#9d9280]">기록된 이벤트가 없어요 (백필된 과거 결제).</p> : (
                <ul className="relative border-l border-[#ebe4d6] ml-1.5 space-y-2.5">
                  {events.map(ev => (
                    <li key={ev.id} className="pl-4 relative">
                      <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${ev.error ? 'bg-[#e11d48]' : ev.processed ? 'bg-[#059669]' : 'bg-[#c4b9a2]'}`} />
                      <p className="font-mono text-[12px] text-[#241f17]">{ev.event_type}</p>
                      <p className="text-[11px] text-[#9d9280]">{new Date(ev.created_at).toLocaleString()}{ev.error ? ` · 오류: ${ev.error}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}
