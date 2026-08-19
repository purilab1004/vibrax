'use client'
// 방송 관리 — 회원들의 카메라/링크 방송 현황, 강제 종료·삭제
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, Segmented, Skeleton, EmptyState, ConfirmModal, Toast, Avatar, btn, th, td, trHover, Pager, usePager } from '@/components/admin/ui'

interface Item { hostId: string; host: string; avatar: string | null; kind: 'camera' | 'link'; id: string | null; url: string | null; gameId: string | null; on: boolean; title?: string; game: { id: string; title: string; thumbnail_url: string } | null }

export default function AdminBroadcastsPage() {
  const [data, setData] = useState<{ items: Item[]; live: number } | null>(null)
  const [filter, setFilter] = useState<'live' | 'all' | 'camera' | 'link'>('live')
  const [confirm, setConfirm] = useState<{ it: Item; action: 'off' | 'remove' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/broadcasts'); if (r.ok) setData(await r.json()) }, [])
  useEffect(() => { const t = setTimeout(load, 0); const iv = setInterval(load, 30_000); return () => { clearTimeout(t); clearInterval(iv) } }, [load])
  const act = async () => {
    if (!confirm) return
    const r = await fetch('/api/admin/broadcasts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostId: confirm.it.hostId, kind: confirm.it.kind, id: confirm.it.id, action: confirm.action }) })
    setConfirm(null); setToast(r.ok ? (confirm.action === 'off' ? '방송을 종료했어요.' : '방송을 삭제했어요.') : '실패'); setTimeout(() => setToast(null), 2400); load()
  }
  const items = (data?.items ?? []).filter(i => filter === 'all' || (filter === 'live' ? i.on : i.kind === filter))
  const pager = usePager(items, 25)
  const header = <PageHeader title="방송 관리" desc="회원이 켠 카메라(WebRTC)·링크(YouTube/Twitch) 방송을 한눈에 보고, 문제가 있으면 즉시 종료하거나 삭제할 수 있어요. 30초마다 갱신."
    actions={<Segmented value={filter} onChange={setFilter} options={[{ value: 'live', label: `ON AIR ${data?.live ?? 0}` }, { value: 'camera', label: '카메라' }, { value: 'link', label: '링크' }, { value: 'all', label: '전체' }]} />} />
  if (!data) return <div>{header}<Skeleton /></div>
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="ON AIR" value={data.live} accent="#dc2626" />
        <StatCard label="카메라 방송" value={data.items.filter(i => i.kind === 'camera').length} accent="#7c3aed" />
        <StatCard label="링크 방송" value={data.items.filter(i => i.kind === 'link').length} accent="#2563eb" />
        <StatCard label="방송 설정 회원" value={new Set(data.items.map(i => i.hostId)).size} />
      </div>
      <Card className="overflow-hidden">
        {items.length === 0 ? <EmptyState title="표시할 방송이 없어요" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>호스트</th><th className={th}>종류</th><th className={th}>게임</th><th className={th}>링크</th><th className={th}>상태</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{pager.slice.map((it, i) => (
              <tr key={`${it.hostId}-${it.id ?? it.kind}-${i}`} className={trHover}>
                <td className={td}><div className="flex items-center gap-2.5"><Avatar url={it.avatar} name={it.host} size={30} /><Link href={`/admin/aj/${it.hostId}`} className="font-semibold text-[#1f2430] hover:text-[#2563eb]">{it.host}</Link></div></td>
                <td className={td}><Badge color={it.kind === 'camera' ? '#7c3aed' : '#2563eb'}>{it.kind === 'camera' ? '카메라' : '링크'}</Badge></td>
                <td className={td}>{it.game ? <Link href={`/games/${it.game.id}`} className="flex items-center gap-2 hover:text-[#2563eb]"><span className="w-12 h-8 rounded overflow-hidden bg-gray-900 shrink-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={it.game.thumbnail_url} alt="" className="w-full h-full object-cover" /></span><span className="truncate max-w-[200px]">{it.game.title}</span></Link> : <span className="text-[#9aa1ad]">-</span>}</td>
                <td className={`${td} max-w-[260px] truncate`}>{it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">{it.title ?? it.url}</a> : <span className="text-[#9aa1ad]">폰 카메라</span>}</td>
                <td className={td}>{it.on ? <Badge color="#dc2626">ON AIR</Badge> : <span className="text-[12px] text-[#9aa1ad]">off</span>}</td>
                <td className={td}><div className="flex gap-1.5 justify-end">
                  {it.on && <button onClick={() => setConfirm({ it, action: 'off' })} className={btn.danger + ' !h-8 !px-2.5'}>강제 종료</button>}
                  <button onClick={() => setConfirm({ it, action: 'remove' })} className="inline-flex items-center h-8 px-2.5 rounded-md border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#dc2626] hover:text-[#dc2626]">삭제</button>
                </div></td>
              </tr>))}</tbody>
          </table><Pager {...pager} /></div>
        )}
      </Card>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={act} title={confirm?.action === 'off' ? '방송 강제 종료' : '방송 삭제'} confirmLabel={confirm?.action === 'off' ? '종료' : '삭제'} desc={<><b>{confirm?.it.host}</b> 의 {confirm?.it.kind === 'camera' ? '카메라' : '링크'} 방송을 {confirm?.action === 'off' ? '끕니다. 회원은 다시 켤 수 있어요.' : '설정에서 제거합니다.'}</>} />
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
