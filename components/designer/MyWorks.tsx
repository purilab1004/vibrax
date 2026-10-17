'use client'
// 공개 작품 — 갤러리에 신청·공개한 작품의 상태, 게임에 쓰인 횟수, 쌓인 크레딧
import { useEffect, useState } from 'react'
import { ui } from './shared'

interface Mine { id: string; kind: string; name: string; title: string; url: string; status: string; uses: number | null; credit_earned: number | null; created_at: string; meta?: { thumb?: string } | null }
const STATUS: Record<string, { label: string; cls: string }> = { pending: { label: '승인 대기', cls: 'bg-[#fff4d6] text-[#8a5a00]' }, active: { label: '공개 중', cls: 'bg-[#dcfce7] text-[#15803d]' }, rejected: { label: '반려', cls: 'bg-[#fee2e2] text-[#b91c1c]' }, archived: { label: '공개 중단', cls: 'bg-[#f1ece2] text-[#4b5563]' } }

export default function MyWorks({ refresh }: { refresh: number }) {
  const [items, setItems] = useState<Mine[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = () => fetch('/api/library/upload').then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]))
  useEffect(() => { load() }, [refresh])
  const act = async (a: Mine, action: 'unpublish' | 'republish' | 'delete') => {
    const ask = { unpublish: `‘${a.title}’ 을(를) 갤러리에서 내릴까요? (파일은 남아서 이미 쓴 게임은 그대로 돌아가요)`, republish: `‘${a.title}’ 을(를) 다시 공개 신청할까요?`, delete: `‘${a.title}’ 을(를) 완전히 삭제할까요? 되돌릴 수 없어요.` }[action]
    if (!confirm(ask)) return
    setBusy(a.id); setMsg(null)
    const r = await fetch('/api/library/upload', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, action }) })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setMsg(j.error ?? '실패'); return }
    setMsg(action === 'unpublish' ? '갤러리에서 내렸어요' : action === 'republish' ? (j.status === 'active' ? '다시 공개했어요' : '다시 공개 신청했어요 — 관리자 승인 후 보여요') : '삭제했어요')
    load()
  }
  const sum = (k: 'uses' | 'credit_earned') => (items ?? []).reduce((a, b) => a + (b[k] ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['공개·신청 작품', (items ?? []).length], ['게임에 쓰인 횟수', sum('uses')], ['쌓인 크레딧', sum('credit_earned')]].map(([l, v]) => (
          <div key={String(l)} className={`${ui.card} px-4 py-4`}><p className="text-[11.5px] font-bold text-[#8a93a6]">{l}</p><p className="mt-1 text-[24px] font-black text-[#1f2937] tabular-nums">{Number(v).toLocaleString()}</p></div>
        ))}
      </div>
      <p className="text-[12.5px] text-[#4b5563]" style={{ wordBreak: 'keep-all' }}>드라이브에서 파일을 열고 <b>‘갤러리에 공개 신청’</b> 을 누르면 여기 올라와요. 관리자가 승인하면 갤러리에 공개되고, 회원이 게임에 쓸 때마다 크레딧이 100% 쌓여요.</p>
      {msg && <p className="text-[12.5px] font-bold text-[#2563eb]">{msg}</p>}
      {items === null ? <p className="py-16 text-center text-[13px] text-[#8a93a6]">불러오는 중…</p> : items.length === 0 ? <p className={`${ui.card} py-16 text-center text-[13px] text-[#8a93a6]`}>아직 공개 신청한 작품이 없어요</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-[4px] overflow-hidden border border-[#e5e9f2] bg-white">
              <div className={`aspect-square ${ui.checker} flex items-center justify-center`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.kind === 'audio' ? <span className="text-3xl"></span> : a.kind === 'model3d' ? (a.meta?.thumb ? <img src={a.meta.thumb} alt={a.title} className="w-full h-full object-contain" /> : <span className="text-3xl"></span>) : <img src={a.url} alt={a.title} className="w-full h-full object-contain" />}
              </div>
              <div className="px-2.5 py-2">
                <div className="flex items-center justify-between gap-1"><p className="text-[12.5px] font-bold text-[#1f2937] truncate">{a.title}</p><span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] ${STATUS[a.status]?.cls ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span></div>
                <p className="text-[10.5px] text-[#8a93a6] truncate">사용 {a.uses ?? 0} · 크레딧 {(a.credit_earned ?? 0).toLocaleString()}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.status === 'active' && <button disabled={busy === a.id} onClick={() => act(a, 'unpublish')} className="h-7 px-2 rounded-[4px] border border-[#dde3ee] text-[11px] font-bold text-[#374151] hover:bg-[#f7f9fd] disabled:opacity-40">공개 중단</button>}
                  {(a.status === 'archived' || a.status === 'rejected') && <button disabled={busy === a.id} onClick={() => act(a, 'republish')} className="h-7 px-2 rounded-[4px] border border-[#c7d7fb] text-[11px] font-bold text-[#2563eb] hover:bg-[#f5f8ff] disabled:opacity-40">다시 공개 신청</button>}
                  {a.status !== 'active' && !(a.uses ?? 0) && <button disabled={busy === a.id} onClick={() => act(a, 'delete')} className="h-7 px-2 rounded-[4px] border border-[#fecaca] text-[11px] font-bold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-40">삭제</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
