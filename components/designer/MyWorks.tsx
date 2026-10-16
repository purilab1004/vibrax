'use client'
// 공개 작품 — 갤러리에 신청·공개한 작품의 상태, 게임에 쓰인 횟수, 쌓인 크레딧
import { useEffect, useState } from 'react'
import { ui } from './shared'

interface Mine { id: string; kind: string; name: string; title: string; url: string; status: string; uses: number | null; credit_earned: number | null; created_at: string; meta?: { thumb?: string } | null }
const STATUS: Record<string, { label: string; cls: string }> = { pending: { label: '승인 대기', cls: 'bg-[#fff4d6] text-[#8a5a00]' }, active: { label: '공개 중', cls: 'bg-[#dcfce7] text-[#15803d]' }, rejected: { label: '반려', cls: 'bg-[#fee2e2] text-[#b91c1c]' }, archived: { label: '보관', cls: 'bg-[#f1ece2] text-[#6b6152]' } }

export default function MyWorks({ refresh }: { refresh: number }) {
  const [items, setItems] = useState<Mine[] | null>(null)
  useEffect(() => { fetch('/api/library/upload').then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([])) }, [refresh])
  const sum = (k: 'uses' | 'credit_earned') => (items ?? []).reduce((a, b) => a + (b[k] ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['공개·신청 작품', (items ?? []).length], ['게임에 쓰인 횟수', sum('uses')], ['쌓인 크레딧', sum('credit_earned')]].map(([l, v]) => (
          <div key={String(l)} className={`${ui.card} px-4 py-4`}><p className="text-[11.5px] font-bold text-[#9d9280]">{l}</p><p className="mt-1 text-[24px] font-black text-[#241f17] tabular-nums">{Number(v).toLocaleString()}</p></div>
        ))}
      </div>
      <p className="text-[12.5px] text-[#6b6152]" style={{ wordBreak: 'keep-all' }}>드라이브에서 파일을 열고 <b>‘갤러리에 공개 신청’</b> 을 누르면 여기 올라와요. 관리자가 승인하면 갤러리에 공개되고, 회원이 게임에 쓸 때마다 크레딧이 100% 쌓여요.</p>
      {items === null ? <p className="py-16 text-center text-[13px] text-[#9d9280]">불러오는 중…</p> : items.length === 0 ? <p className={`${ui.card} py-16 text-center text-[13px] text-[#9d9280]`}>아직 공개 신청한 작품이 없어요</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl overflow-hidden border border-[#ebe4d6] bg-white">
              <div className={`aspect-square ${ui.checker} flex items-center justify-center`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.kind === 'audio' ? <span className="text-3xl">🎵</span> : a.kind === 'model3d' ? (a.meta?.thumb ? <img src={a.meta.thumb} alt={a.title} className="w-full h-full object-contain" /> : <span className="text-3xl">🧊</span>) : <img src={a.url} alt={a.title} className="w-full h-full object-contain" />}
              </div>
              <div className="px-2.5 py-2">
                <div className="flex items-center justify-between gap-1"><p className="text-[12.5px] font-bold text-[#241f17] truncate">{a.title}</p><span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS[a.status]?.cls ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span></div>
                <p className="text-[10.5px] text-[#9d9280] truncate">사용 {a.uses ?? 0} · 크레딧 {(a.credit_earned ?? 0).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
