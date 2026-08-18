// Paddle transaction 페이로드 → payments 행으로 정규화 (웹훅·동기화 공용)
import type { SupabaseClient } from '@supabase/supabase-js'
import { creditsForPriceId, CREDIT_PACKS, packPriceId } from '@/lib/studio/constants'
import type { PaddleTransaction } from '@/lib/paddle/api'

export function normalizeTransaction(tx: PaddleTransaction, customerEmail?: string | null) {
  const items = Array.isArray(tx.items) ? tx.items : []
  let credits = 0; let priceId: string | null = null
  for (const it of items) { credits += creditsForPriceId(it.price?.id) * (it.quantity ?? 1); priceId = priceId ?? it.price?.id ?? null }
  const pack = CREDIT_PACKS.find(p => packPriceId(p.key) === priceId)?.key ?? null
  const total = tx.details?.totals?.grand_total ?? tx.details?.totals?.total ?? null
  const pm = tx.payments?.[tx.payments.length - 1]?.method_details
  return {
    id: tx.id,
    user_id: tx.custom_data?.user_id ?? null,
    amount_minor: total != null ? Number(total) : null,
    currency: tx.currency_code ?? null,
    credits, price_id: priceId, pack_key: pack,
    customer_email: customerEmail ?? null,
    paddle_customer_id: tx.customer_id ?? null,
    invoice_number: tx.invoice_number ?? null,
    payment_method: pm?.type ?? null,
    card_brand: pm?.card?.type ?? null,
    card_last4: pm?.card?.last4 ?? null,
    billed_at: tx.billed_at ?? tx.created_at ?? null,
    raw: tx as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }
}

// 결제 완료 반영: payments upsert + 크레딧 지급(멱등: ref_id unique)
export async function applyCompleted(admin: SupabaseClient, tx: PaddleTransaction, customerEmail?: string | null) {
  const row = normalizeTransaction(tx, customerEmail)
  await admin.from('payments').upsert({ ...row, status: 'completed' } as never, { onConflict: 'id', ignoreDuplicates: false })
  if (row.user_id && row.credits > 0) {
    const { error } = await admin.from('credit_ledger').insert([{ user_id: row.user_id, amount: row.credits, reason: 'purchase', ref_id: tx.id }] as never)
    if (error && error.code !== '23505') throw error
  }
  return row
}

// 환불/차지백 반영: 상태 갱신 + 지급 크레딧 회수(멱등: purchase_refund ref unique). 잔액이 부족해도 회수는 기록(음수 허용) — 어뷰징 방지
export async function applyRefund(admin: SupabaseClient, txId: string, opts: { amountMinor?: number | null; reason?: string | null; kind: 'refund' | 'chargeback'; partial?: boolean }) {
  const { data: p } = await admin.from('payments').select('id,user_id,credits,amount_minor,refunded_minor,credits_revoked').eq('id', txId).maybeSingle()
  const pay = p as { id: string; user_id: string | null; credits: number; amount_minor: number | null; refunded_minor: number; credits_revoked: boolean } | null
  if (!pay) return null
  const refunded = (pay.refunded_minor ?? 0) + (opts.amountMinor ?? 0)
  const full = !opts.partial || (pay.amount_minor != null && refunded >= pay.amount_minor)
  const status = opts.kind === 'chargeback' ? 'chargeback' : full ? 'refunded' : 'partially_refunded'
  await admin.from('payments').update({ status, refunded_minor: refunded, refund_reason: opts.reason ?? null, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq('id', txId)
  // 크레딧 회수 — 전액 환불/차지백일 때 지급분 전부 회수
  if (full && pay.user_id && pay.credits > 0 && !pay.credits_revoked) {
    const { error } = await admin.from('credit_ledger').insert([{ user_id: pay.user_id, amount: -pay.credits, reason: opts.kind === 'chargeback' ? 'chargeback' : 'purchase_refund', ref_id: txId }] as never)
    if (error && error.code !== '23505') throw error
    await admin.from('payments').update({ credits_revoked: true } as never).eq('id', txId)
  }
  return status
}
