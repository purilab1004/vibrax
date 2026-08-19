// Paddle REST API (서버 전용) — 환불(adjustment) 요청 · 트랜잭션 조회/동기화
// PADDLE_API_KEY 가 없으면 호출 불가 → 호출부에서 안내 문구로 폴백한다.
const BASE = (process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox') ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'

export const paddleConfigured = () => !!process.env.PADDLE_API_KEY
export const paddleDashboardUrl = (txId: string) =>
  `${process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox' ? 'https://sandbox-vendors.paddle.com' : 'https://vendors.paddle.com'}/transactions-v2/${txId}`

async function callAt<T>(base: string, key: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(j?.error?.detail ?? j?.error?.code ?? `Paddle ${r.status}`); (e as Error & { status?: number }).status = r.status; throw e }
  return j as T
}
// 현재 환경 키로 호출하고, 트랜잭션이 다른 환경(예: 샌드박스 테스트 결제)에 있으면 PADDLE_SANDBOX_API_KEY 로 한 번 더 시도
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.PADDLE_API_KEY
  if (!key) throw new Error('PADDLE_API_KEY 미설정')
  try { return await callAt<T>(BASE, key, path, init) }
  catch (e) {
    const alt = process.env.PADDLE_SANDBOX_API_KEY
    const st = (e as Error & { status?: number }).status
    if (!alt || alt === key || (st !== 404 && st !== 400)) throw e
    const altBase = BASE.includes('sandbox') ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
    return await callAt<T>(altBase, alt, path, init)
  }
}

export interface PaddleTransaction {
  id: string; status: string; currency_code: string; customer_id: string | null; invoice_number: string | null
  billed_at: string | null; created_at: string; custom_data?: { user_id?: string } | null
  details?: { totals?: { total?: string; grand_total?: string } } | null
  items?: { price?: { id?: string }; quantity?: number }[]
  payments?: { status?: string; error_code?: string | null; method_details?: { type?: string; card?: { type?: string; last4?: string } } }[]
  origin?: string
}

export const getTransaction = (id: string) => call<{ data: PaddleTransaction }>(`/transactions/${id}?include=customer`)
export const listTransactions = (after?: string) => call<{ data: PaddleTransaction[]; meta: { pagination: { has_more: boolean; next?: string } } }>(`/transactions?status=completed,past_due,ready,billed,canceled&per_page=100${after ? `&after=${after}` : ''}`)
// 영수증(인보이스 PDF) — 완료된 트랜잭션만. 반환 URL 은 단기 유효
export const getInvoiceUrl = (id: string) => call<{ data: { url: string } }>(`/transactions/${id}/invoice?disposition=inline`)
export const getCustomer = (id: string) => call<{ data: { email?: string } }>(`/customers/${id}`)

// 전체 환불 요청 — Paddle 이 검토 후 승인/거절 (adjustment.updated 웹훅으로 결과 수신)
export const requestFullRefund = (transactionId: string, reason: string) =>
  call<{ data: { id: string; status: string } }>('/adjustments', {
    method: 'POST',
    body: JSON.stringify({ action: 'refund', transaction_id: transactionId, reason, type: 'full' }),
  })
