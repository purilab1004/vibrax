'use client'
// 관리자 — 게임 디자이너 접수 확인(승인 → 직분 designer), 디자이너가 올린 에셋 승인(공개)/반려
import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, EmptyState, btn, th, td, trHover, Segmented } from '@/components/admin/ui'

interface App { id: string; user_id: string; name: string; email: string; portfolio_url: string | null; message: string | null; status: string; created_at: string }
interface Pending { id: string; kind: string; name: string; title: string; description: string | null; tags: string[]; url: string; width: number | null; height: number | null; bytes: number; status: string; created_at: string; designer_name: string | null }
interface Designer { id: string; username: string | null; agent_name: string | null; email: string | null; created_at: string }

export default function AdminDesignersPage() {
  const [apps, setApps] = useState<App[]>([]); const [pending, setPending] = useState<Pending[]>([]); const [designers, setDesigners] = useState<Designer[]>([])
  const [missing, setMissing] = useState(false); const [msg, setMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const load = async () => { const j = await fetch('/api/admin/designers').then((r) => r.json()); if (j.missing) setMissing(true); setApps(j.applications ?? []); setPending(j.pending ?? []); setDesigners(j.designers ?? []) }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])
  const act = async (type: 'application' | 'asset', id: string, action: 'approve' | 'reject') => {
    const r = await fetch('/api/admin/designers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, action }) }); const j = await r.json()
    setMsg(!r.ok ? j.error ?? '실패' : type === 'application' ? (action === 'approve' ? '승인 — 회원 직분이 디자이너로 바뀌었어요. 안내 메일을 보내 주세요.' : '접수를 거절했어요') : (action === 'approve' ? '에셋을 공개했어요' : '에셋을 반려했어요'))
    load()
  }
  const shownApps = filter === 'pending' ? apps.filter((a) => a.status === 'pending') : apps
  const fmt = (s: string) => new Date(s).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <PageHeader title="게임 디자이너" desc="접수를 확인해 승인하면 회원 직분이 '디자이너'로 바뀌고 내 정보에 라이브러리가 생깁니다. 디자이너가 올린 에셋은 승인해야 라이브러리와 게임 생성에 공개됩니다. 회원이 디자인을 쓰며 낸 크레딧은 100% 디자이너에게 쌓입니다." />
      {missing && <Card className="p-4 border-[#f59e0b] bg-[#fffbeb]"><p className="text-[13px] text-[#92400e]">테이블이 아직 없어요. Supabase SQL 편집기에서 <code>db/migrations/2026-09-17-jackpot-library.sql</code> 을 실행해 주세요.</p></Card>}
      {msg && <p className="text-[13px] font-semibold text-[#2563eb]">{msg}</p>}

      <Card>
        <div className="flex items-center justify-between px-4 pt-4"><h3 className="text-[14px] font-bold">접수 ({apps.filter((a) => a.status === 'pending').length}건 대기)</h3><Segmented value={filter} onChange={setFilter} options={[{ value: 'pending', label: '대기' }, { value: 'all', label: '전체' }]} /></div>
        <div className="overflow-x-auto mt-3">
          {shownApps.length === 0 ? <EmptyState icon="✍️" title="접수가 없어요" /> : (
            <table className="w-full"><thead><tr><th className={th}>이름</th><th className={th}>이메일</th><th className={th}>포트폴리오</th><th className={th}>메시지</th><th className={th}>접수</th><th className={th}>상태</th><th className={th}></th></tr></thead>
              <tbody>{shownApps.map((a) => (
                <tr key={a.id} className={trHover}>
                  <td className={td}><b>{a.name}</b></td>
                  <td className={td}><a href={`mailto:${a.email}?subject=${encodeURIComponent('[Vibrexcup] 게임 디자이너 접수 안내')}`} className="text-[#2563eb] underline">{a.email}</a></td>
                  <td className={td}>{a.portfolio_url ? <a href={a.portfolio_url} target="_blank" rel="noreferrer" className="text-[#2563eb] underline truncate inline-block max-w-[200px]">{a.portfolio_url}</a> : '-'}</td>
                  <td className={td}><span className="line-clamp-2 max-w-[260px]">{a.message ?? '-'}</span></td>
                  <td className={td}>{fmt(a.created_at)}</td>
                  <td className={td}><Badge color={a.status === 'approved' ? '#16a34a' : a.status === 'rejected' ? '#dc2626' : '#f59e0b'}>{a.status === 'approved' ? '승인' : a.status === 'rejected' ? '거절' : '대기'}</Badge></td>
                  <td className={td}>{a.status === 'pending' && <div className="flex gap-1"><button onClick={() => act('application', a.id, 'approve')} className={btn.primary}>승인 → 디자이너</button><button onClick={() => act('application', a.id, 'reject')} className={btn.ghost}>거절</button></div>}</td>
                </tr>
              ))}</tbody></table>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-[14px] font-bold px-4 pt-4">승인 대기 에셋 ({pending.filter((p) => p.status === 'pending').length})</h3>
        <div className="p-4">
          {pending.length === 0 ? <EmptyState icon="🎨" title="대기 중인 에셋이 없어요" /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {pending.map((p) => (
                <div key={p.id} className="rounded-xl border border-[#e3e6ec] overflow-hidden bg-white">
                  <div className="aspect-square bg-[repeating-conic-gradient(#f3f5f8_0_25%,#fff_0_50%)] bg-[length:14px_14px] flex items-center justify-center">
                    {p.kind === 'audio' ? <audio src={p.url} controls className="w-[90%]" /> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={p.title} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[12px] font-semibold truncate">{p.title}</p>
                    <p className="text-[10.5px] text-[#6b7280] truncate">{p.kind} · {p.width ? `${p.width}×${p.height} · ` : ''}{Math.round(p.bytes / 1024)}KB · {p.designer_name ?? '?'}</p>
                    {p.status === 'rejected' ? <Badge color="#dc2626">반려됨</Badge> : <div className="flex gap-1 mt-1.5"><button onClick={() => act('asset', p.id, 'approve')} className={btn.primary + ' !h-7 !px-2.5 !text-[11.5px]'}>공개</button><button onClick={() => act('asset', p.id, 'reject')} className={btn.ghost + ' !h-7 !px-2.5 !text-[11.5px]'}>반려</button></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-[14px] font-bold px-4 pt-4">디자이너 회원 ({designers.length})</h3>
        <div className="p-4 flex flex-wrap gap-2">{designers.length === 0 ? <p className="text-[12.5px] text-[#6b7280]">아직 없어요</p> : designers.map((d) => <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#e3e6ec] px-3 py-1.5 text-[12px]"><span className="font-semibold">{d.agent_name ?? d.username ?? '회원'}</span><span className="text-[#6b7280]">{d.email}</span></span>)}</div>
      </Card>
    </div>
  )
}
