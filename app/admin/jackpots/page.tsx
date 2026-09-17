'use client'
// 관리자 — 코인 잭팟: ① 제목·설명·참가비·당첨자 수 ② 상품(선택) 등록 ③ 잭팟 열기 → 추첨 → 당첨자 목록에서 상금 직접 수여
import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, Badge, EmptyState, btn, input, label, th, td, trHover, ConfirmModal, Segmented } from '@/components/admin/ui'
import JackpotCard from '@/components/JackpotCard'

interface Product { id: string; title: string; description: string | null; image_url: string | null; coin_price: number; active: boolean }
interface Winner { id: string; rank: number; user_id: string; name: string; email: string | null; amount: number; prize: 'credits' | 'product'; awarded: boolean; awarded_at: string | null; note: string | null }
interface Jackpot { id: string; title: string; description: string | null; image_url: string | null; entry_cost: number; ends_at: string; status: string; pool: number; entries: number; winner_count?: number; product_id?: string | null; product_threshold?: number; product: Product | null; winner_name: string | null; winners: Winner[]; drawn_at: string | null; created_at: string }

type ProductMode = 'none' | 'existing' | 'new'
const emptyForm = { id: '' as string, title: '', description: '', entry_cost: 50, ends_at: '', winner_count: 1, image: null as File | null, image_url: null as string | null, remove_image: false, product_mode: 'none' as ProductMode, product_id: '', product_threshold: 1000, product_title: '', product_description: '', product_image: null as File | null }

const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const fmt = (s: string) => new Date(s).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

export default function AdminJackpotsPage() {
  const [items, setItems] = useState<Jackpot[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [missing, setMissing] = useState(false)
  const [needsV2, setNeedsV2] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'settle' | 'cancel'; n?: number } | null>(null)
  const [openWinners, setOpenWinners] = useState<string | null>(null)
  const [award, setAward] = useState<Record<string, { amount: number; note: string }>>({})
  const [nowTs] = useState(() => Date.now())
  const imagePreview = useObjectUrl(form.image)
  const productPreview = useObjectUrl(form.product_image)

  const load = async () => {
    const [a, b] = await Promise.all([fetch('/api/admin/jackpots').then((r) => r.json()), fetch('/api/admin/products').then((r) => r.json())])
    if (a.missing || b.missing) setMissing(true)
    setNeedsV2(!!a.needsV2)
    setItems(a.items ?? []); setProducts(b.items ?? [])
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const selectedProduct = products.find((p) => p.id === form.product_id) ?? null

  const autoDescription = () => {
    const t = Math.max(0, form.product_threshold).toLocaleString()
    set('description', form.product_mode === 'none'
      ? `이번 잭팟은 상품 없이 모인 크레딧만 드려요! 마감 후 추첨으로 당첨 ${form.winner_count}명에게 크레딧이 지급됩니다.`
      : `이번 주 상품은 이번 잭팟 금액 ${t} 크레딧 초과 시 당첨된 회원에게 상품이 나갑니다!`)
  }

  const submit = async () => {
    if (!form.title.trim() || !form.ends_at) { setMsg({ text: '제목과 마감 시각을 입력하세요', err: true }); return }
    if (form.product_mode === 'new' && !form.product_title.trim()) { setMsg({ text: '상품명을 입력하세요', err: true }); return }
    if (form.product_mode === 'existing' && !form.product_id) { setMsg({ text: '등록된 상품을 선택하세요', err: true }); return }
    setBusy(true); setMsg(null)
    const fd = new FormData()
    if (form.id) fd.append('id', form.id)
    fd.append('title', form.title); fd.append('description', form.description); fd.append('entry_cost', String(form.entry_cost)); fd.append('winner_count', String(form.winner_count))
    fd.append('ends_at', new Date(form.ends_at).toISOString())
    if (form.image) fd.append('image', form.image); else if (form.remove_image) fd.append('remove_image', '1')
    fd.append('product_mode', form.product_mode)
    if (form.product_mode !== 'none') fd.append('product_threshold', String(form.product_threshold))
    if (form.product_mode === 'existing') fd.append('product_id', form.product_id)
    if (form.product_mode === 'new') { fd.append('product_title', form.product_title); fd.append('product_description', form.product_description); if (form.product_image) fd.append('product_image', form.product_image) }
    const r = await fetch('/api/admin/jackpots', { method: 'POST', body: fd }); const j = await r.json()
    setBusy(false); if (!r.ok) { setMsg({ text: j.error ?? '실패', err: true }); return }
    setMsg({ text: form.id ? '잭팟을 수정했어요' : '잭팟을 열었어요 — 쇼츠 피드에 나옵니다' }); setForm(emptyForm); load()
  }

  const edit = (j: Jackpot) => {
    setForm({ ...emptyForm, id: j.id, title: j.title, description: j.description ?? '', entry_cost: j.entry_cost, ends_at: toLocalInput(j.ends_at), winner_count: j.winner_count ?? 1, image_url: j.image_url, product_mode: j.product_id ? 'existing' : 'none', product_id: j.product_id ?? '', product_threshold: j.product_threshold ?? 1000 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const act = async () => {
    if (!confirm) return
    setBusy(true)
    const r = await fetch('/api/admin/jackpots', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: confirm.id, action: confirm.action }) }); const j = await r.json()
    setBusy(false); setConfirm(null)
    if (!r.ok) setMsg({ text: j.error ?? '실패', err: true })
    else if (confirm.action === 'settle') {
      if (j.legacy) setMsg({ text: '⚠️ 예전 추첨 함수로 처리됐어요(당첨 1명에게 자동 지급). jackpot-v2.sql 을 실행해 주세요.', err: true })
      else if (!j.count) setMsg({ text: '참여자가 없어 취소 처리됐어요' })
      else { setMsg({ text: `추첨 완료 — 당첨자 ${j.count}명. 아래 당첨자 목록에서 상금을 수여하세요` }); setOpenWinners(confirm.id) }
    } else setMsg({ text: `취소했어요 (환불 ${j.refunded ?? 0}명)` })
    load()
  }

  const giveAward = async (w: Winner, payCredits: boolean) => {
    const a = award[w.id] ?? { amount: w.amount, note: '' }
    setBusy(true)
    const r = await fetch('/api/admin/jackpots', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'award', winner_id: w.id, amount: a.amount, pay_credits: payCredits, note: a.note }) }); const j = await r.json()
    setBusy(false)
    setMsg(!r.ok ? { text: j.error ?? '실패', err: true } : { text: j.paid ? `${w.name} 님에게 ✦ ${Number(j.paid).toLocaleString()} 크레딧을 지급했어요` : `${w.name} 님 수여 완료로 표시했어요` })
    load()
  }
  const undoAward = async (w: Winner) => {
    const r = await fetch('/api/admin/jackpots', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unaward', winner_id: w.id }) }); const j = await r.json()
    if (!r.ok) setMsg({ text: j.error ?? '실패', err: true }); load()
  }
  const delProduct = async (id: string) => { await fetch('/api/admin/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load() }

  // 미리보기 카드
  const previewProductImage = form.product_mode === 'new' ? productPreview : selectedProduct?.image_url ?? null
  const preview = {
    id: 'preview', title: form.title || '이번 게임 제목', description: form.description || null,
    image_url: form.remove_image ? null : imagePreview ?? form.image_url, entry_cost: form.entry_cost,
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : new Date(nowTs + 86400000 * 3).toISOString(),
    status: 'open', pool: 0, entries: 0, winner_count: form.winner_count, has_product: form.product_mode !== 'none', product_threshold: form.product_threshold,
  }
  const [previewMode, setPreviewMode] = useState<'open' | 'drawn'>('open')
  const previewJackpot = previewMode === 'drawn' && form.product_mode !== 'none'
    ? { ...preview, status: 'drawn', pool: form.product_threshold + 1, product: { title: form.product_mode === 'new' ? form.product_title || '상품명' : selectedProduct?.title ?? '상품명', description: null, image_url: previewProductImage }, product_won: true, winners: Array.from({ length: Math.min(3, form.winner_count) }, (_, i) => ({ rank: i + 1, name: `당첨자${i + 1}`, prize: 'product' })) }
    : preview

  return (
    <div className="space-y-6">
      <PageHeader title="크레딧 잭팟" desc="① 제목·설명·참가비·당첨자 수를 넣고 ② 상품이 있으면 등록한 뒤 ③ 잭팟을 엽니다. 마감 후 추첨하면 당첨자 목록이 만들어지고, 상금(크레딧·상품)은 관리자가 직접 수여해요." />
      {missing && <Card className="p-4 border-[#f59e0b] bg-[#fffbeb]"><p className="text-[13px] text-[#92400e]">테이블이 아직 없어요. Supabase SQL 편집기에서 <code>db/migrations/2026-09-17-jackpot-library.sql</code> 을 실행해 주세요.</p></Card>}
      {needsV2 && <Card className="p-4 border-[#f59e0b] bg-[#fffbeb]"><p className="text-[13px] text-[#92400e]">상품·당첨자 수·당첨자 목록을 쓰려면 Supabase SQL 편집기에서 <code>db/migrations/2026-09-17-jackpot-v2.sql</code> 을 실행해 주세요. (실행 전 추첨은 예전 방식으로 1명에게 자동 지급돼요)</p></Card>}
      {msg && <p className={`text-[13px] font-semibold ${msg.err ? 'text-[#dc2626]' : 'text-[#2563eb]'}`}>{msg.text}</p>}

      <div className="grid xl:grid-cols-[1fr_360px] gap-4 items-start">
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold">{form.id ? '잭팟 수정' : '새 잭팟 열기'}</h3>
            {form.id && <button onClick={() => setForm(emptyForm)} className={btn.ghost}>새로 만들기로</button>}
          </div>

          <section className="space-y-3">
            <p className="text-[12px] font-bold text-[#6b7280]">① 잭팟 정보</p>
            <div><label className={label}>이번 게임 제목 <span className="text-[#9ca3af] font-normal">— 쇼츠에서 크게 보여요</span></label><input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 이번 주 판도라 잭팟" /></div>
            <div>
              <div className="flex items-center justify-between"><label className={label}>설명</label><button type="button" onClick={autoDescription} className="text-[11.5px] font-semibold text-[#2563eb] hover:underline">설명 자동 작성</button></div>
              <textarea className={`${input} min-h-[72px] py-2`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={form.product_mode === 'none' ? '예: 상품 없이 모인 크레딧만 드려요!' : '예: 이번 주 상품은 이번 잭팟 금액 1,000 크레딧 초과 시 당첨된 회원에게 상품이 나갑니다!'} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><label className={label}>참가비 (크레딧/1장)</label><input className={input} type="number" min={1} value={form.entry_cost} onChange={(e) => set('entry_cost', Number(e.target.value))} /></div>
              <div><label className={label}>당첨자 수</label><input className={input} type="number" min={1} max={100} value={form.winner_count} onChange={(e) => set('winner_count', Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={label}>마감(추첨) 시각</label><input className={input} type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>대표 이미지 <span className="text-[#9ca3af] font-normal">— 쇼츠 가운데에서 레인보우 빛과 함께 빛나요 · 초록 배경은 자동으로 지워져요</span></label>
              <div className="flex items-center gap-3">
                {(imagePreview || (form.image_url && !form.remove_image)) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview ?? form.image_url ?? ''} alt="" className="w-14 h-14 rounded-lg object-contain bg-[#1f1048]" />
                )}
                <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, image: e.target.files?.[0] ?? null, remove_image: false }))} className="text-[12px]" />
                {form.id && form.image_url && !form.image && <button type="button" onClick={() => set('remove_image', !form.remove_image)} className="text-[11.5px] text-[#dc2626]">{form.remove_image ? '삭제 취소' : '이미지 빼기'}</button>}
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-[#eef0f3] pt-4">
            <p className="text-[12px] font-bold text-[#6b7280]">② 상품 (선택)</p>
            <Segmented value={form.product_mode} onChange={(v) => set('product_mode', v)} options={[{ value: 'none', label: '상품 없음 (크레딧만)' }, { value: 'new', label: '새 상품 등록' }, { value: 'existing', label: '등록된 상품' }]} />
            {form.product_mode === 'none' && <p className="text-[12px] text-[#6b7280]">당첨자에게 모인 크레딧만 지급해요. 제목·설명에 &ldquo;크레딧만 지급&rdquo;이라고 적어 주세요.</p>}
            {form.product_mode === 'new' && (
              <div className="grid sm:grid-cols-2 gap-2">
                <div><label className={label}>상품명</label><input className={input} value={form.product_title} onChange={(e) => set('product_title', e.target.value)} placeholder="예: 에어팟 프로" /></div>
                <div><label className={label}>상품 설명</label><input className={input} value={form.product_description} onChange={(e) => set('product_description', e.target.value)} /></div>
                <div className="sm:col-span-2">
                  <label className={label}>상품 썸네일 <span className="text-[#9ca3af] font-normal">— 추첨 후 판도라 박스에서 빛나며 공개 · 초록 배경 자동 제거</span></label>
                  <div className="flex items-center gap-3">
                    {productPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={productPreview} alt="" className="w-14 h-14 rounded-lg object-contain bg-[#1f1048]" />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => set('product_image', e.target.files?.[0] ?? null)} className="text-[12px]" />
                  </div>
                </div>
              </div>
            )}
            {form.product_mode === 'existing' && (
              products.length === 0 ? <p className="text-[12px] text-[#6b7280]">등록된 상품이 없어요. &lsquo;새 상품 등록&rsquo;을 선택하세요.</p> : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {products.map((p) => (
                    <button type="button" key={p.id} onClick={() => set('product_id', p.id)} className={`relative rounded-lg border p-1.5 text-left ${form.product_id === p.id ? 'border-[#2563eb] ring-2 ring-[#2563eb]/30' : 'border-[#e3e6ec]'}`}>
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.title} className="w-full aspect-square object-contain rounded bg-[#1f1048]" />
                      ) : <div className="w-full aspect-square rounded bg-[#f3f5f8] flex items-center justify-center">🎁</div>}
                      <p className="text-[11px] font-semibold truncate mt-1">{p.title}</p>
                    </button>
                  ))}
                </div>
              )
            )}
            {form.product_mode !== 'none' && (
              <div className="max-w-[260px]"><label className={label}>상품 지급 조건 — 잭팟 금액 (크레딧) 초과 시</label><input className={input} type="number" min={0} value={form.product_threshold} onChange={(e) => set('product_threshold', Math.max(0, Number(e.target.value) || 0))} /></div>
            )}
          </section>

          <section className="border-t border-[#eef0f3] pt-4 flex items-center gap-2">
            <button onClick={submit} disabled={busy} className={btn.primary}>{busy ? '저장 중…' : form.id ? '③ 잭팟 수정 저장' : '③ 잭팟 열기'}</button>
            <span className="text-[11.5px] text-[#6b7280]">{form.product_mode === 'new' ? '상품이 먼저 등록되고 잭팟이 열려요' : ''}</span>
          </section>
        </Card>

        <div className="space-y-2 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold text-[#6b7280]">쇼츠 미리보기</p>
            {form.product_mode !== 'none' && <Segmented value={previewMode} onChange={setPreviewMode} options={[{ value: 'open', label: '진행 중' }, { value: 'drawn', label: '당첨 발표' }]} />}
          </div>
          <div className="relative w-full max-w-[360px] mx-auto aspect-[9/15] rounded-2xl overflow-hidden shadow-lg">
            <JackpotCard key={`${previewMode}-${previewProductImage ?? ''}`} jackpot={previewJackpot} layout="preview" />
          </div>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          {items === null ? <p className="p-4 text-[12.5px] text-[#6b7280]">불러오는 중…</p> : items.length === 0 ? <EmptyState icon="🎰" title="아직 잭팟이 없어요" desc="위에서 첫 잭팟을 열어 보세요." /> : (
            <table className="w-full">
              <thead><tr><th className={th}>잭팟</th><th className={th}>상품</th><th className={th}>참가비</th><th className={th}>풀 / 참여</th><th className={th}>당첨</th><th className={th}>마감</th><th className={th}>상태</th><th className={th}></th></tr></thead>
              <tbody>
                {items.map((j) => {
                  const pending = j.winners.filter((w) => !w.awarded).length
                  return [
                    <tr key={j.id} className={trHover}>
                      <td className={td}><div className="flex items-center gap-2">{j.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={j.image_url} alt="" className="w-9 h-9 rounded object-contain bg-[#1f1048]" />)}<div><p className="font-semibold">{j.title}</p><p className="text-[11px] text-[#6b7280] truncate max-w-[240px]">{j.description}</p></div></div></td>
                      <td className={td}>{j.product ? <div className="flex items-center gap-1.5">{j.product.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={j.product.image_url} alt="" className="w-7 h-7 rounded object-contain bg-[#1f1048]" />)}<div><p className="text-[12px] font-semibold">{j.product.title}</p><p className="text-[10.5px] text-[#6b7280]">✦ {(j.product_threshold ?? 0).toLocaleString()} 초과 시</p></div></div> : <span className="text-[11.5px] text-[#9ca3af]">크레딧만</span>}</td>
                      <td className={td}>✦ {j.entry_cost}</td>
                      <td className={td}><b>{j.pool.toLocaleString()}</b> / {j.entries}장</td>
                      <td className={td}>{j.winner_count ?? 1}명</td>
                      <td className={td}>{fmt(j.ends_at)}</td>
                      <td className={td}><Badge color={j.status === 'open' ? '#16a34a' : j.status === 'drawn' ? '#7c3aed' : '#6b7280'}>{j.status === 'open' ? (new Date(j.ends_at).getTime() < nowTs ? '마감(추첨 대기)' : '진행 중') : j.status === 'drawn' ? '추첨 완료' : '취소'}</Badge></td>
                      <td className={td}>
                        <div className="flex gap-1 justify-end flex-wrap">
                          {j.status === 'open' && <>
                            <button onClick={() => edit(j)} className={btn.ghost}>수정</button>
                            <button onClick={() => setConfirm({ id: j.id, action: 'settle', n: j.winner_count ?? 1 })} className={btn.primary}>추첨</button>
                            <button onClick={() => setConfirm({ id: j.id, action: 'cancel' })} className={btn.ghost}>취소·환불</button>
                          </>}
                          {j.status === 'drawn' && <button onClick={() => setOpenWinners(openWinners === j.id ? null : j.id)} className={pending ? btn.primary : btn.ghost}>당첨자 {j.winners.length}명{pending ? ` · 수여 대기 ${pending}` : ''}</button>}
                        </div>
                      </td>
                    </tr>,
                    openWinners === j.id && (
                      <tr key={`${j.id}-w`}><td colSpan={8} className="bg-[#f8f9fb] px-4 py-3">
                        {j.winners.length === 0 ? <p className="text-[12.5px] text-[#6b7280]">{j.winner_name ? `당첨: ${j.winner_name} (예전 방식 — 자동 지급됨)` : '당첨자 기록이 없어요.'}</p> : (
                          <table className="w-full bg-white rounded-lg border border-[#e3e6ec]">
                            <thead><tr><th className={th}>순위</th><th className={th}>회원</th><th className={th}>상금</th><th className={th}>크레딧</th><th className={th}>메모</th><th className={th}>상태</th><th className={th}></th></tr></thead>
                            <tbody>
                              {j.winners.map((w) => {
                                const a = award[w.id] ?? { amount: w.amount, note: '' }
                                return (
                                  <tr key={w.id}>
                                    <td className={td}>🏆 {w.rank}</td>
                                    <td className={td}><p className="font-semibold">{w.name}</p><p className="text-[11px] text-[#6b7280]">{w.email ?? w.user_id.slice(0, 8)}</p></td>
                                    <td className={td}>{w.prize === 'product' ? <Badge color="#db2777">🎁 상품{j.product ? ` · ${j.product.title}` : ''}</Badge> : <Badge color="#d97706">✦ 크레딧</Badge>}</td>
                                    <td className={td}>{w.awarded ? `✦ ${w.amount.toLocaleString()}` : <input className={`${input} w-[110px]`} type="number" min={0} value={a.amount} onChange={(e) => setAward({ ...award, [w.id]: { ...a, amount: Math.max(0, Number(e.target.value) || 0) } })} />}</td>
                                    <td className={td}>{w.awarded ? <span className="text-[11.5px] text-[#6b7280]">{w.note ?? '-'}</span> : <input className={`${input} w-[180px]`} value={a.note} placeholder={w.prize === 'product' ? '예: 택배 발송 완료' : '메모'} onChange={(e) => setAward({ ...award, [w.id]: { ...a, note: e.target.value } })} />}</td>
                                    <td className={td}>{w.awarded ? <Badge color="#16a34a">수여 완료 · {w.awarded_at ? fmt(w.awarded_at) : ''}</Badge> : <Badge color="#f59e0b">수여 대기</Badge>}</td>
                                    <td className={td}>
                                      {w.awarded ? (!/크레딧 지급/.test(w.note ?? '') && <button onClick={() => undoAward(w)} className={btn.ghost}>되돌리기</button>) : (
                                        <div className="flex gap-1 justify-end">
                                          <button disabled={busy || a.amount <= 0} onClick={() => giveAward(w, true)} className={btn.primary}>✦ 크레딧 지급</button>
                                          <button disabled={busy} onClick={() => giveAward(w, false)} className={btn.ghost}>{w.prize === 'product' ? '상품 지급 완료' : '지급 완료 표시'}</button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </td></tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {products.length > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="text-[14px] font-bold">상품 보관함 <span className="text-[11px] font-normal text-[#6b7280]">— 잭팟에 건 상품들 (다음 잭팟에서 &lsquo;등록된 상품&rsquo;으로 다시 쓸 수 있어요)</span></h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {products.map((p) => (
              <div key={p.id} className="relative rounded-lg border border-[#e3e6ec] p-1.5">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className="w-full aspect-square object-contain rounded bg-[#1f1048]" />
                ) : <div className="w-full aspect-square rounded bg-[#f3f5f8] flex items-center justify-center">🎁</div>}
                <p className="text-[11px] font-semibold truncate mt-1">{p.title}</p>
                <button onClick={() => delProduct(p.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px]">✕</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={act} busy={busy} title={confirm?.action === 'settle' ? '지금 추첨할까요?' : '잭팟을 취소할까요?'} desc={confirm?.action === 'settle' ? `낸 크레딧만큼의 확률로 당첨자 ${confirm?.n ?? 1}명을 뽑습니다(한 회원은 한 번만). 상금은 자동으로 나가지 않아요 — 당첨자 목록에서 직접 수여하세요. 되돌릴 수 없어요.` : '참여자 전원에게 크레딧을 환불하고 잭팟을 닫습니다.'} confirmLabel={confirm?.action === 'settle' ? '추첨' : '취소·환불'} />
    </div>
  )
}
