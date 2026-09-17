// 관리자 — 잭팟 만들기(상품 함께 등록)/수정/목록/추첨/취소 + 당첨자 목록·상금 수여
import { requireAdmin } from '@/lib/admin/guard'
import { uploadPrizeImage } from '@/lib/media/jackpot-image'

export const runtime = 'nodejs'

type Row = { id: string; winner_user_id: string | null; product_id?: string | null }
type Winner = { id: string; jackpot_id: string; user_id: string; rank: number; amount: number; prize: 'credits' | 'product'; awarded: boolean; awarded_at: string | null; note: string | null }
type Prof = { id: string; username: string | null; agent_name: string | null; email?: string | null }

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data, error } = await g.admin.from('jackpots').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as Row[]
  const ids = rows.map((j) => j.id)
  // 당첨자 목록 (v2 마이그레이션 전이면 테이블이 없다 → needsV2)
  let winners: Winner[] = []; let needsV2 = !rows.length ? false : !('winner_count' in (rows[0] as object))
  if (ids.length) {
    const w = await g.admin.from('jackpot_winners').select('*').in('jackpot_id', ids).order('rank')
    if (w.error) needsV2 = true; else winners = (w.data ?? []) as Winner[]
  } else {
    const w = await g.admin.from('jackpot_winners').select('id').limit(1)
    if (w.error) needsV2 = true
  }
  const userIds = [...new Set([...rows.map((j) => j.winner_user_id), ...winners.map((w) => w.user_id)].filter((x): x is string => !!x))]
  const profs: Record<string, Prof> = {}
  if (userIds.length) { const { data: ps } = await g.admin.from('profiles').select('id,username,agent_name,email').in('id', userIds); for (const p of (ps ?? []) as Prof[]) profs[p.id] = p }
  const nameOf = (id: string | null) => { const p = id ? profs[id] : null; return p ? `${p.agent_name ?? p.username ?? '회원'}${p.email ? ` (${p.email})` : ''}` : null }
  const productIds = [...new Set(rows.map((j) => j.product_id).filter((x): x is string => !!x))]
  const products: Record<string, unknown> = {}
  if (productIds.length) { const { data: ps } = await g.admin.from('products').select('*').in('id', productIds); for (const p of (ps ?? []) as { id: string }[]) products[p.id] = p }
  return Response.json({
    needsV2,
    items: rows.map((j) => ({
      ...(j as object),
      winner_name: nameOf(j.winner_user_id),
      product: j.product_id ? products[j.product_id] ?? null : null,
      winners: winners.filter((w) => w.jackpot_id === j.id).map((w) => ({ ...w, name: profs[w.user_id]?.agent_name ?? profs[w.user_id]?.username ?? '회원', email: profs[w.user_id]?.email ?? null })),
    })),
  })
}

// 폼 → 잭팟 필드 (+ 상품: 없음 / 기존 상품 선택 / 새로 등록)
async function readForm(g: Exclude<Awaited<ReturnType<typeof requireAdmin>>, { error: Response }>, fd: FormData, partial: boolean) {
  const out: Record<string, unknown> = {}
  const str = (k: string) => String(fd.get(k) ?? '').trim()
  if (!partial || fd.has('title')) { const title = str('title'); if (!title) return { error: '제목을 입력하세요' }; out.title = title }
  if (!partial || fd.has('description')) out.description = str('description') || null
  if (!partial || fd.has('entry_cost')) out.entry_cost = Math.max(1, Math.min(100000, Number(fd.get('entry_cost') ?? 50) || 50))
  if (!partial || fd.has('ends_at')) { const ends = str('ends_at'); if (!ends || isNaN(Date.parse(ends))) return { error: '마감 시각을 입력하세요' }; out.ends_at = new Date(ends).toISOString() }
  if (!partial || fd.has('winner_count')) out.winner_count = Math.max(1, Math.min(100, Math.floor(Number(fd.get('winner_count') ?? 1) || 1)))
  const img = fd.get('image')
  if (img instanceof File && img.size > 0) { const up = await uploadPrizeImage(g.admin, img, 'jackpot'); if ('error' in up) return up; out.image_url = up.url }
  else if (fd.get('remove_image') === '1') out.image_url = null
  const mode = str('product_mode') // none | existing | new
  if (mode === 'none') { out.product_id = null; out.product_threshold = 0 }
  else if (mode === 'existing' || mode === 'new') {
    out.product_threshold = Math.max(0, Math.floor(Number(fd.get('product_threshold') ?? 0) || 0))
    if (mode === 'existing') { const pid = str('product_id'); if (!pid) return { error: '상품을 선택하세요' }; out.product_id = pid }
    else {
      const ptitle = str('product_title'); if (!ptitle) return { error: '상품명을 입력하세요' }
      let pimg: string | null = null
      const pf = fd.get('product_image')
      if (pf instanceof File && pf.size > 0) { const up = await uploadPrizeImage(g.admin, pf, 'product'); if ('error' in up) return up; pimg = up.url }
      const { data: prod, error } = await g.admin.from('products').insert([{ title: ptitle, description: str('product_description') || null, image_url: pimg, coin_price: 0 }] as never).select('id').single()
      if (error) return { error: '상품 등록 실패: ' + error.message }
      out.product_id = (prod as { id: string }).id
    }
  }
  return { fields: out }
}

const v2Hint = (m: string) => /winner_count|product_threshold|product_id|jackpot_winners|jackpot_refund/.test(m) ? `${m} — Supabase 에서 db/migrations/2026-09-17-jackpot-v2.sql 을 먼저 실행하세요` : m

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const fd = await req.formData().catch(() => null)
  if (!fd) return Response.json({ error: 'multipart 필요' }, { status: 400 })
  const id = String(fd.get('id') ?? '')
  const r = await readForm(g, fd, !!id)
  if ('error' in r) return Response.json({ error: r.error }, { status: 400 })
  if (id) {
    const { data, error } = await g.admin.from('jackpots').update(r.fields as never).eq('id', id).select('*').single()
    if (error) return Response.json({ error: v2Hint(error.message) }, { status: 500 })
    return Response.json({ item: data })
  }
  const { data, error } = await g.admin.from('jackpots').insert([{ ...r.fields, created_by: g.user.id }] as never).select('*').single()
  if (error) return Response.json({ error: v2Hint(error.message) }, { status: 500 })
  return Response.json({ item: data })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { id?: string; action?: 'settle' | 'cancel' | 'award' | 'unaward'; winner_id?: string; amount?: number; pay_credits?: boolean; note?: string } | null
  if (!body?.action) return Response.json({ error: 'bad request' }, { status: 400 })

  if (body.action === 'award' || body.action === 'unaward') {
    if (!body.winner_id) return Response.json({ error: 'winner_id' }, { status: 400 })
    if (body.action === 'unaward') {
      // 크레딧을 이미 지급한 건은 되돌리지 않는다(원장 기록) — 상품 지급 표시만 해제
      const { data: w } = await g.admin.from('jackpot_winners').select('note').eq('id', body.winner_id).maybeSingle()
      if (/(크레딧|토큰동전) 지급/.test((w as { note: string | null } | null)?.note ?? '')) return Response.json({ error: '토큰동전을 지급한 건은 해제할 수 없어요' }, { status: 400 })
      const { error } = await g.admin.from('jackpot_winners').update({ awarded: false, awarded_at: null, awarded_by: null } as never).eq('id', body.winner_id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }
    const amount = Math.max(0, Math.floor(Number(body.amount ?? 0) || 0))
    const pay = !!body.pay_credits && amount > 0
    const note = [pay ? `✦ ${amount.toLocaleString()} 토큰동전 지급` : null, (body.note ?? '').trim() || null].filter(Boolean).join(' · ') || null
    // 한 번만 — awarded=false 인 행만 잡는다
    const { data: rows, error } = await g.admin.from('jackpot_winners').update({ awarded: true, awarded_at: new Date().toISOString(), awarded_by: g.user.id, amount, note } as never).eq('id', body.winner_id).eq('awarded', false).select('id,user_id,jackpot_id')
    if (error) return Response.json({ error: v2Hint(error.message) }, { status: 500 })
    const row = (rows ?? [])[0] as { id: string; user_id: string; jackpot_id: string } | undefined
    if (!row) return Response.json({ error: '이미 수여된 당첨자예요' }, { status: 409 })
    if (pay) {
      const { error: le } = await g.admin.from('credit_ledger').insert([{ user_id: row.user_id, amount, reason: 'jackpot_win', ref_id: `${row.jackpot_id}:${row.id}` }] as never)
      if (le) { await g.admin.from('jackpot_winners').update({ awarded: false, awarded_at: null, awarded_by: null } as never).eq('id', row.id); return Response.json({ error: '토큰동전 지급 실패: ' + le.message }, { status: 500 }) }
    }
    return Response.json({ ok: true, paid: pay ? amount : 0 })
  }

  if (!body.id) return Response.json({ error: 'bad request' }, { status: 400 })
  if (body.action === 'settle') {
    // 관리자 세션으로 RPC (is_admin 확인은 함수 안에서)
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('settle_jackpot', { p_jackpot_id: body.id } as never)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    // v1 함수(uuid 반환·자동 지급)가 남아 있으면 알려 준다
    if (typeof data === 'string' || data === null) return Response.json({ ok: true, count: data ? 1 : 0, legacy: true })
    return Response.json({ ok: true, count: Number(data) || 0 })
  }
  // 취소 — open 인 것만 잡아서(중복 환불 방지) 참여 크레딧 환불
  const { data: closed, error } = await g.admin.from('jackpots').update({ status: 'cancelled', drawn_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'open').select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!(closed ?? []).length) return Response.json({ error: '이미 닫힌 잭팟이에요' }, { status: 409 })
  const { data: ents } = await g.admin.from('jackpot_entries').select('user_id,coins').eq('jackpot_id', body.id)
  const sums: Record<string, number> = {}
  for (const e of (ents ?? []) as { user_id: string; coins: number }[]) sums[e.user_id] = (sums[e.user_id] ?? 0) + e.coins
  const refunds = Object.entries(sums).map(([user_id, amount]) => ({ user_id, amount, reason: 'jackpot_refund', ref_id: body.id }))
  if (refunds.length) {
    const { error: le } = await g.admin.from('credit_ledger').insert(refunds as never)
    if (le) {
      await g.admin.from('jackpots').update({ status: 'open', drawn_at: null }).eq('id', body.id)   // 환불 실패면 취소도 되돌린다
      return Response.json({ error: v2Hint('환불 실패: ' + le.message) }, { status: 500 })
    }
  }
  return Response.json({ ok: true, refunded: refunds.length })
}
