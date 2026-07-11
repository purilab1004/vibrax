import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaddleSignature } from '@/lib/paddle/verify'
import { creditsForPriceId } from '@/lib/studio/constants'

export async function POST(req: Request) {
  const raw = await req.text()
  const sig = req.headers.get('paddle-signature') ?? ''
  if (!verifyPaddleSignature(raw, sig, process.env.PADDLE_WEBHOOK_SECRET ?? '')) {
    return new Response('invalid signature', { status: 401 })
  }

  let event: { event_type?: string; data?: { id?: string; custom_data?: { user_id?: string }; items?: unknown } }
  try {
    event = JSON.parse(raw)
  } catch {
    console.error('[webhook/paddle] malformed JSON')
    return new Response('ignored', { status: 200 })
  }
  if (event.event_type !== 'transaction.completed') {
    return new Response('ignored', { status: 200 })
  }

  const userId: string | undefined = event.data?.custom_data?.user_id
  const txId: string | undefined = event.data?.id
  const items = Array.isArray(event.data?.items) ? event.data.items : []
  let credits = 0
  for (const item of items) {
    credits += creditsForPriceId(item.price?.id) * (item.quantity ?? 1)
  }
  if (!userId || !txId || credits <= 0) {
    // 매핑 불가 이벤트 — 재시도해도 결과가 같으므로 200
    console.error('[webhook/paddle] unmapped transaction', { txId, userId, credits })
    return new Response('ignored', { status: 200 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('credit_ledger').insert([
    { user_id: userId, amount: credits, reason: 'purchase', ref_id: txId },
  ] as never)
  // unique 위반(23505) = 이미 지급(중복 웹훅) → 정상 처리
  if (error && error.code !== '23505') {
    console.error('[webhook/paddle] grant failed', error)
    return new Response('error', { status: 500 })
  }
  console.log('[webhook/paddle] granted', { txId, userId, credits })
  return new Response('ok', { status: 200 })
}
