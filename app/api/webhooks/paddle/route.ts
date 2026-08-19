// Paddle 웹훅 — 모든 이벤트를 payment_events 에 기록하고,
//   transaction.completed → 결제 저장 + 크레딧 지급
//   adjustment.created/updated (refund/chargeback, approved) → 환불 상태 + 크레딧 회수
//   transaction.payment_failed / canceled → 상태 기록
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/log/server'
import { verifyPaddleSignature } from '@/lib/paddle/verify'
import { applyCompleted, applyFailed, applyRefund, normalizeTransaction } from '@/lib/paddle/sync'
import { getCustomer, paddleConfigured, type PaddleTransaction } from '@/lib/paddle/api'
import { paddleWebhookIps, requestIp } from '@/lib/paddle/ips'

interface Adjustment { id: string; action: string; status: string; transaction_id: string; reason?: string; totals?: { total?: string }; type?: string; items?: unknown[] }

export async function POST(req: Request) {
  // 1차 방어: Paddle 발신 IP 허용목록 (런타임 조회) — 목록을 못 받으면 서명 검증만으로 진행
  const allow = await paddleWebhookIps()
  const ip = requestIp(req.headers)
  if (allow && ip && !allow.has(ip)) return new Response('forbidden ip', { status: 403 })
  const raw = await req.text()
  const sig = req.headers.get('paddle-signature') ?? ''
  if (!verifyPaddleSignature(raw, sig, process.env.PADDLE_WEBHOOK_SECRET ?? '')) {
    return new Response('invalid signature', { status: 401 })
  }
  let event: { event_id?: string; event_type?: string; data?: unknown }
  try { event = JSON.parse(raw) } catch { console.error('[webhook/paddle] malformed JSON'); return new Response('ignored', { status: 200 }) }
  const type = event.event_type ?? 'unknown'
  const data = (event.data ?? {}) as Record<string, unknown>
  const txId = (typeof data.transaction_id === 'string' ? data.transaction_id : typeof data.id === 'string' && String(data.id).startsWith('txn_') ? data.id : null) as string | null
  const admin = createAdminClient()

  // 1) 이벤트 로그 (중복 이벤트는 무시)
  const { data: logged, error: logErr } = await admin.from('payment_events')
    .insert([{ event_id: event.event_id ?? null, event_type: type, transaction_id: txId, payload: event as never }] as never).select('id').maybeSingle()
  if (logErr && logErr.code === '23505') return new Response('duplicate', { status: 200 })
  const logId = (logged as { id: string } | null)?.id
  const finish = async (ok: boolean, err?: string) => {
    if (logId) await admin.from('payment_events').update({ processed: ok, error: err ?? null } as never).eq('id', logId)
  }

  try {
    if (type === 'transaction.completed') {
      const tx = data as unknown as PaddleTransaction
      let email: string | null = null
      if (tx.customer_id && paddleConfigured()) { try { email = (await getCustomer(tx.customer_id)).data.email ?? null } catch { /* 이메일은 부가 정보 */ } }
      const row = await applyCompleted(admin, tx, email)
      if (!row.user_id || row.credits <= 0) { console.error('[webhook/paddle] unmapped transaction', { txId: tx.id, userId: row.user_id, credits: row.credits }); void logServerError('webhook', new Error('unmapped transaction'), { path: '/api/webhooks/paddle', level: 'warn', meta: { txId: tx.id, userId: row.user_id, credits: row.credits } }) }
      else console.log('[webhook/paddle] granted', { txId: tx.id, userId: row.user_id, credits: row.credits })
    } else if (type === 'transaction.updated' || type === 'transaction.paid' || type === 'transaction.billed') {
      // 완료 전/후 부가 정보 갱신 (이미 저장된 결제만)
      const tx = data as unknown as PaddleTransaction
      const { data: exists } = await admin.from('payments').select('id').eq('id', tx.id).maybeSingle()
      if (exists) await admin.from('payments').update(normalizeTransaction(tx) as never).eq('id', tx.id)
    } else if (type === 'transaction.payment_failed' || type === 'transaction.canceled') {
      // 실패/취소도 결제 관리에 남긴다 (회원·금액·카드·사유)
      const tx = data as unknown as PaddleTransaction
      let email: string | null = null
      if (tx.customer_id && paddleConfigured()) { try { email = (await getCustomer(tx.customer_id)).data.email ?? null } catch { /* */ } }
      await applyFailed(admin, tx, email)
    } else if (type === 'adjustment.created' || type === 'adjustment.updated') {
      const adj = data as unknown as Adjustment
      if (adj.transaction_id) {
        if (adj.action === 'refund' && adj.status === 'pending_approval') {
          await admin.from('payments').update({ status: 'refund_pending', refund_reason: adj.reason ?? null, updated_at: new Date().toISOString() } as never).eq('id', adj.transaction_id).neq('status', 'refunded')
        } else if (adj.action === 'refund' && adj.status === 'approved') {
          await applyRefund(admin, adj.transaction_id, { amountMinor: adj.totals?.total != null ? Number(adj.totals.total) : null, reason: adj.reason ?? null, kind: 'refund', partial: adj.type === 'partial' })
        } else if (adj.action === 'refund' && adj.status === 'rejected') {
          await admin.from('payments').update({ status: 'completed', updated_at: new Date().toISOString() } as never).eq('id', adj.transaction_id).eq('status', 'refund_pending')
        } else if (adj.action === 'chargeback' || adj.action === 'chargeback_warning') {
          await applyRefund(admin, adj.transaction_id, { amountMinor: adj.totals?.total != null ? Number(adj.totals.total) : null, reason: adj.reason ?? 'chargeback', kind: 'chargeback' })
        } else if (adj.action === 'chargeback_reverse') {
          await admin.from('payments').update({ status: 'completed', updated_at: new Date().toISOString() } as never).eq('id', adj.transaction_id)
        }
      }
    }
    await finish(true)
    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('[webhook/paddle] failed', type, e)
    void logServerError('webhook', e, { path: '/api/webhooks/paddle', meta: { type, txId } })
    await finish(false, e instanceof Error ? e.message : String(e))
    return new Response('error', { status: 500 })
  }
}
