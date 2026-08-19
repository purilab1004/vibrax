'use client'
// 에러 로그 관리 — 클라이언트/서버/웹훅 에러를 지문(fingerprint)별로 그룹핑, 해결 처리·삭제
import { useCallback, useEffect, useMemo, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, Badge, Segmented, Skeleton, EmptyState, ConfirmModal, Toast, Pager, usePager, btn, input, th, td, trHover } from '@/components/admin/ui'

interface Grp { fingerprint: string; message: string; source: string; level: string; path: string | null; count: number; count24h: number; users: number; first: string; last: string; resolved: boolean; sample: { stack: string | null; user_agent: string | null; user_id: string | null; meta: unknown; created_at: string } }
interface Data { days: number; total: number; last24h: number; unresolved: number; bySource: Record<string, number>; byDay: { day: string; n: number }[]; groups: Grp[] }
const SRC: Record<string, string> = { client: '#2563eb', server: '#e11d48', api: '#f59e0b', webhook: '#7c3aed' }

export default function AdminLogsPage() {
  const [days, setDays] = useState(7)
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null; missing?: boolean }>({ days: 0, data: null, err: null })
  const data = state.days === days ? state.data : null
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open')
  const [source, setSource] = useState<'all' | 'client' | 'server' | 'api' | 'webhook'>('all')
  const [q, setQ] = useState('')
  const [openFp, setOpenFp] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ fp?: string; all?: boolean } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = useCallback(async (d: number) => {
    const r = await fetch(`/api/admin/logs?days=${d}`); const j = await r.json()
    if (!r.ok) setState({ days: d, data: null, err: j.error, missing: j.missing }); else setState({ days: d, data: j, err: null })
  }, [])
  useEffect(() => { const t = setTimeout(() => load(days), 0); return () => clearTimeout(t) }, [days, load])
  const resolve = async (fp: string, resolved: boolean) => { await fetch('/api/admin/logs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fingerprint: fp, resolved }) }); say(resolved ? '해결 처리했어요.' : '다시 열었어요.'); load(days) }
  const del = async () => { if (!confirm) return; await fetch('/api/admin/logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confirm.all ? { all: true } : { fingerprint: confirm.fp }) }); setConfirm(null); say('삭제했어요.'); load(days) }
  const groups = useMemo(() => (data?.groups ?? []).filter(x => (filter === 'all' || (filter === 'resolved') === x.resolved) && (source === 'all' || x.source === source) && (!q.trim() || x.message.toLowerCase().includes(q.toLowerCase()) || (x.path ?? '').includes(q))), [data, filter, source, q])
  const pager = usePager(groups, 25)
  const header = <PageHeader title="에러 로그" desc="브라우저(window.onerror·unhandledrejection)와 서버 API·웹훅에서 발생한 에러를 같은 원인끼리 묶어 보여줍니다."
    actions={<><Segmented value={days} onChange={setDays} options={[{ value: 1, label: '24h' }, { value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]} /><button onClick={() => setConfirm({ all: true })} className={btn.ghost}>전체 비우기</button></>} />
  if (state.days === days && state.err) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{state.missing ? <>로그 테이블이 없어요. <code>db/migrations/2026-08-18-logs.sql</code> 을 실행하세요.</> : state.err}</Card></div>
  if (!data) return <div>{header}<Skeleton rows={6} /></div>
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="에러 (기간)" value={data.total} sub={`24시간 ${data.last24h}건`} accent="#e11d48" />
        <StatCard label="미해결 이슈" value={data.unresolved} sub="지문별 그룹" accent="#f59e0b" />
        <StatCard label="클라이언트 / 서버" value={`${data.bySource.client ?? 0} / ${(data.bySource.server ?? 0) + (data.bySource.api ?? 0)}`} sub={`웹훅 ${data.bySource.webhook ?? 0}`} accent="#2563eb" />
        <TrendChart label="일별 에러" values={data.byDay.map(d => d.n)} labels={data.byDay.map(d => d.day.slice(5))} color="#e11d48" />
      </div>
      <Card>
        <div className="flex items-center gap-3 flex-wrap p-3 border-b border-[#e3e6ec]">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="메시지 · 경로 검색" className={`${input} max-w-xs`} />
          <Segmented value={source} onChange={setSource} options={[{ value: 'all', label: '전체' }, { value: 'client', label: '클라이언트' }, { value: 'api', label: 'API' }, { value: 'server', label: '서버' }, { value: 'webhook', label: '웹훅' }]} />
          <div className="ml-auto"><Segmented value={filter} onChange={setFilter} options={[{ value: 'open', label: '미해결' }, { value: 'resolved', label: '해결됨' }, { value: 'all', label: '전체' }]} /></div>
        </div>
        {groups.length === 0 ? <EmptyState title="표시할 에러가 없어요" desc="깨끗해요." /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>에러</th><th className={th}>출처</th><th className={`${th} text-right`}>건수</th><th className={`${th} text-right`}>24h</th><th className={`${th} text-right`}>사용자</th><th className={th}>마지막</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">
              {pager.slice.map(x => (
                <>
                  <tr key={x.fingerprint} className={`${trHover} cursor-pointer ${x.resolved ? 'opacity-50' : ''}`} onClick={() => setOpenFp(openFp === x.fingerprint ? null : x.fingerprint)}>
                    <td className={td}><p className="font-semibold text-[#1f2430] max-w-[520px] truncate font-mono text-[12.5px]">{x.message}</p><p className="text-[11px] text-[#9aa1ad] truncate max-w-[520px]">{x.path ?? '-'}{x.level === 'warn' ? ' · warn' : ''}</p></td>
                    <td className={td}><Badge color={SRC[x.source] ?? '#857a68'}>{x.source}</Badge></td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{x.count}</td>
                    <td className={`${td} text-right tabular-nums`}>{x.count24h}</td>
                    <td className={`${td} text-right tabular-nums`}>{x.users}</td>
                    <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(x.last).toLocaleString()}</td>
                    <td className={td} onClick={e => e.stopPropagation()}><div className="flex gap-1.5 justify-end">
                      <button onClick={() => resolve(x.fingerprint, !x.resolved)} className={btn.ghost + ' !h-8 !px-2.5'}>{x.resolved ? '다시 열기' : '해결'}</button>
                      <button onClick={() => setConfirm({ fp: x.fingerprint })} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#e11d48] hover:text-[#e11d48]">삭제</button>
                    </div></td>
                  </tr>
                  {openFp === x.fingerprint && (
                    <tr key={x.fingerprint + '-d'}><td colSpan={7} className="px-5 py-4 bg-[#f7f8fa]">
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 text-[12.5px]">
                        <pre className="rounded-xl bg-[#241f17] text-[#e8e2d4] text-[11.5px] leading-relaxed p-4 overflow-x-auto max-h-72 whitespace-pre-wrap">{x.sample.stack ?? x.message}</pre>
                        <div className="space-y-1.5 text-[#374151]">
                          <p><span className="text-[#9aa1ad]">처음</span> {new Date(x.first).toLocaleString()}</p>
                          <p><span className="text-[#9aa1ad]">마지막</span> {new Date(x.last).toLocaleString()}</p>
                          <p><span className="text-[#9aa1ad]">사용자</span> {x.sample.user_id ?? '비로그인'}</p>
                          <p className="break-all"><span className="text-[#9aa1ad]">UA</span> {x.sample.user_agent ?? '-'}</p>
                          {x.sample.meta ? <pre className="text-[11px] bg-white border border-[#e3e6ec] rounded-lg p-2 overflow-x-auto">{JSON.stringify(x.sample.meta, null, 1)}</pre> : null}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table><Pager {...pager} /></div>
        )}
      </Card>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title={confirm?.all ? '모든 에러 로그 삭제' : '에러 그룹 삭제'} desc={confirm?.all ? '기록된 에러 로그를 전부 삭제해요.' : '이 지문의 모든 기록을 삭제해요.'} />
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
