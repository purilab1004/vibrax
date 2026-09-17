'use client'
// 관리자 — 코인 잭팟(랜덤 뽑기) 만들기·추첨·취소 + 코인으로 살 수 있는 실제 상품 등록
import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, EmptyState, btn, input, label, th, td, trHover, ConfirmModal } from '@/components/admin/ui'

interface Jackpot { id: string; title: string; description: string | null; image_url: string | null; entry_cost: number; ends_at: string; status: string; pool: number; entries: number; winner_user_id: string | null; winner_name: string | null; drawn_at: string | null; created_at: string }
interface Product { id: string; title: string; description: string | null; image_url: string | null; coin_price: number; active: boolean }

export default function AdminJackpotsPage() {
  const [items, setItems] = useState<Jackpot[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', entry_cost: 50, ends_at: '' , image: null as File | null })
  const [pform, setPform] = useState({ title: '', description: '', coin_price: 1000, image: null as File | null })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'settle' | 'cancel' } | null>(null)
  const load = async () => {
    const [a, b] = await Promise.all([fetch('/api/admin/jackpots').then((r) => r.json()), fetch('/api/admin/products').then((r) => r.json())])
    if (a.missing || b.missing) setMissing(true)
    setItems(a.items ?? []); setProducts(b.items ?? [])
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])
  const [nowTs] = useState(() => Date.now())

  const create = async () => {
    if (!form.title.trim() || !form.ends_at) { setMsg('제목과 마감 시각을 입력하세요'); return }
    setBusy(true); setMsg(null)
    const fd = new FormData(); fd.append('title', form.title); fd.append('description', form.description); fd.append('entry_cost', String(form.entry_cost)); fd.append('ends_at', new Date(form.ends_at).toISOString()); if (form.image) fd.append('image', form.image)
    const r = await fetch('/api/admin/jackpots', { method: 'POST', body: fd }); const j = await r.json()
    setBusy(false); if (!r.ok) { setMsg(j.error ?? '실패'); return }
    setMsg('잭팟을 열었어요 — 쇼츠 피드에 나옵니다'); setForm({ title: '', description: '', entry_cost: 50, ends_at: '', image: null }); load()
  }
  const act = async () => {
    if (!confirm) return
    setBusy(true)
    const r = await fetch('/api/admin/jackpots', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confirm) }); const j = await r.json()
    setBusy(false); setConfirm(null)
    setMsg(!r.ok ? j.error ?? '실패' : confirm.action === 'settle' ? (j.winner ? '추첨 완료 — 당첨자에게 코인을 지급했어요' : '참여자가 없어 취소 처리됐어요') : `취소했어요 (환불 ${j.refunded ?? 0}건)`)
    load()
  }
  const addProduct = async () => {
    if (!pform.title.trim()) return
    setBusy(true)
    const fd = new FormData(); fd.append('title', pform.title); fd.append('description', pform.description); fd.append('coin_price', String(pform.coin_price)); if (pform.image) fd.append('image', pform.image)
    const r = await fetch('/api/admin/products', { method: 'POST', body: fd }); const j = await r.json()
    setBusy(false); if (!r.ok) { setMsg(j.error ?? '실패'); return }
    setPform({ title: '', description: '', coin_price: 1000, image: null }); load()
  }
  const delProduct = async (id: string) => { await fetch('/api/admin/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load() }
  const fmt = (s: string) => new Date(s).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <PageHeader title="크레딧 잭팟" desc="회원이 프롬코인(크레딧)을 내고 참여하는 랜덤 뽑기. 마감 후 추첨하면 당첨 1명이 모인 크레딧을 모두 받아요. 진행 중인 잭팟은 쇼츠 피드에 게임 사이로 나옵니다." />
      {missing && <Card className="p-4 border-[#f59e0b] bg-[#fffbeb]"><p className="text-[13px] text-[#92400e]">테이블이 아직 없어요. Supabase SQL 편집기에서 <code>db/migrations/2026-09-17-jackpot-library.sql</code> 을 실행해 주세요.</p></Card>}
      {msg && <p className="text-[13px] font-semibold text-[#2563eb]">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <h3 className="text-[14px] font-bold">새 잭팟 열기</h3>
          <div><label className={label}>제목</label><input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 이번 주 코인 잭팟" /></div>
          <div><label className={label}>설명</label><input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="예: 당첨 코인으로 에어팟 상품 교환 가능" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>참가비 (크레딧/1장)</label><input className={input} type="number" min={1} value={form.entry_cost} onChange={(e) => setForm({ ...form, entry_cost: Number(e.target.value) })} /></div>
            <div><label className={label}>마감 시각</label><input className={input} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><label className={label}>대표 이미지 (선택)</label><input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} className="text-[12px]" /></div>
          <button onClick={create} disabled={busy} className={btn.primary}>잭팟 열기</button>
        </Card>
        <Card className="p-5 space-y-3">
          <h3 className="text-[14px] font-bold">크레딧 상품 등록 <span className="text-[11px] font-normal text-[#6b7280]">— 크레딧으로 살 수 있는 실제 상품 (잭팟 카드에 표시)</span></h3>
          <div><label className={label}>상품명</label><input className={input} value={pform.title} onChange={(e) => setPform({ ...pform, title: e.target.value })} placeholder="예: 에어팟 프로" /></div>
          <div><label className={label}>설명</label><input className={input} value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>크레딧 가격</label><input className={input} type="number" min={0} value={pform.coin_price} onChange={(e) => setPform({ ...pform, coin_price: Number(e.target.value) })} /></div>
            <div><label className={label}>이미지</label><input type="file" accept="image/*" onChange={(e) => setPform({ ...pform, image: e.target.files?.[0] ?? null })} className="text-[12px] mt-1" /></div>
          </div>
          <button onClick={addProduct} disabled={busy} className={btn.primary}>상품 등록</button>
          {products && products.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
              {products.map((p) => (
                <div key={p.id} className="relative rounded-lg border border-[#e3e6ec] p-1.5">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} className="w-full aspect-square object-cover rounded" />
                  ) : <div className="w-full aspect-square rounded bg-[#f3f5f8] flex items-center justify-center">🎁</div>}
                  <p className="text-[11px] font-semibold truncate mt-1">{p.title}</p><p className="text-[10.5px] text-[#6b7280]">✦ {p.coin_price.toLocaleString()}</p>
                  <button onClick={() => delProduct(p.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px]">✕</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          {items === null ? <p className="p-4 text-[12.5px] text-[#6b7280]">불러오는 중…</p> : items.length === 0 ? <EmptyState icon="🎰" title="아직 잭팟이 없어요" desc="위에서 첫 잭팟을 열어 보세요." /> : (
            <table className="w-full">
              <thead><tr><th className={th}>잭팟</th><th className={th}>참가비</th><th className={th}>풀 / 참여</th><th className={th}>마감</th><th className={th}>상태</th><th className={th}>당첨</th><th className={th}></th></tr></thead>
              <tbody>
                {items.map((j) => (
                  <tr key={j.id} className={trHover}>
                    <td className={td}><div className="flex items-center gap-2">{j.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.image_url} alt="" className="w-8 h-8 rounded object-cover" />)}<div><p className="font-semibold">{j.title}</p><p className="text-[11px] text-[#6b7280] truncate max-w-[260px]">{j.description}</p></div></div></td>
                    <td className={td}>✦ {j.entry_cost}</td>
                    <td className={td}><b>{j.pool.toLocaleString()}</b> / {j.entries}명</td>
                    <td className={td}>{fmt(j.ends_at)}</td>
                    <td className={td}><Badge color={j.status === 'open' ? '#16a34a' : j.status === 'drawn' ? '#7c3aed' : '#6b7280'}>{j.status === 'open' ? (new Date(j.ends_at).getTime() < nowTs ? '마감(추첨 대기)' : '진행 중') : j.status === 'drawn' ? '추첨 완료' : '취소'}</Badge></td>
                    <td className={td}>{j.winner_name ?? '-'}</td>
                    <td className={td}>{j.status === 'open' && <div className="flex gap-1"><button onClick={() => setConfirm({ id: j.id, action: 'settle' })} className={btn.primary}>추첨</button><button onClick={() => setConfirm({ id: j.id, action: 'cancel' })} className={btn.ghost}>취소·환불</button></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={act} busy={busy} title={confirm?.action === 'settle' ? '지금 추첨할까요?' : '잭팟을 취소할까요?'} desc={confirm?.action === 'settle' ? '참여 코인만큼의 확률로 당첨자 1명을 뽑고, 모인 코인 전부를 즉시 지급합니다. 되돌릴 수 없어요.' : '참여자 전원에게 코인을 환불하고 잭팟을 닫습니다.'} confirmLabel={confirm?.action === 'settle' ? '추첨' : '취소·환불'} />
    </div>
  )
}
