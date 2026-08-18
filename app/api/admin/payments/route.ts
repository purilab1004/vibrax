// 관리자 결제 API — 목록/통계(GET), 환불 요청·수동 처리·동기화(POST)
import { requireAdmin } from '@/lib/admin/guard'
import { getCustomer, getTransaction, listTransactions, paddleConfigured, paddleDashboardUrl, requestFullRefund } from '@/lib/paddle/api'
import { applyCompleted, applyRefund } from '@/lib/paddle/sync'

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get('days') ?? 30)))
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await g.admin.from('payments').select('*, profiles(username, agent_name, avatar_config)').gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as Record<string, unknown>[]
  // 통계 (통화별 합계 — 보통 USD 단일)
  const sum = (f: (r: Record<string, unknown>) => number) => rows.reduce((s, r) => s + f(r), 0)
  const completed = rows.filter(r => ['completed', 'partially_refunded', 'refund_pending'].includes(String(r.status)))
  const refunded = rows.filter(r => ['refunded', 'chargeback'].includes(String(r.status)))
  const gross = sum(r => Number(r.amount_minor ?? 0))
  const refundedMinor = sum(r => Number(r.refunded_minor ?? 0))
  const currency = (rows.find(r => r.currency)?.currency as string | undefined) ?? 'USD'
  const byDay: Record<string, { gross: number; count: number; refunded: number }> = {}
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); byDay[d] = { gross: 0, count: 0, refunded: 0 } }
  for (const r of rows) {
    const d = String(r.created_at).slice(0, 10); if (!byDay[d]) continue
    byDay[d].count++; byDay[d].gross += Number(r.amount_minor ?? 0); byDay[d].refunded += Number(r.refunded_minor ?? 0)
  }
  const byPack: Record<string, { count: number; gross: number; credits: number }> = {}
  for (const r of rows) { const k = String(r.pack_key ?? 'unknown'); byPack[k] ??= { count: 0, gross: 0, credits: 0 }; byPack[k].count++; byPack[k].gross += Number(r.amount_minor ?? 0); byPack[k].credits += Number(r.credits ?? 0) }
  return Response.json({
    days, currency, configured: paddleConfigured(), env: process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'production',
    totals: { count: rows.length, completed: completed.length, refunded: refunded.length, gross, refundedMinor, net: gross - refundedMinor, credits: sum(r => Number(r.credits ?? 0)), buyers: new Set(rows.map(r => r.user_id).filter(Boolean)).size, unknownAmount: rows.filter(r => r.amount_minor == null).length },
    byDay: Object.entries(byDay).map(([day, v]) => ({ day, ...v })),
    byPack,
    rows: rows.map(r => ({ ...r, raw: undefined, dashboard_url: paddleDashboardUrl(String(r.id)) })),
  })
}

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { action?: string; id?: string; reason?: string } | null
  if (!b?.action) return Response.json({ error: 'bad request' }, { status: 400 })

  // Paddle 에 전액 환불 요청 (Paddle 승인 후 웹훅으로 최종 반영)
  if (b.action === 'refund') {
    if (!b.id) return Response.json({ error: 'bad request' }, { status: 400 })
    if (!paddleConfigured()) return Response.json({ error: 'PADDLE_API_KEY 가 설정되지 않아 API 환불을 보낼 수 없어요. Paddle 대시보드에서 환불한 뒤 "수동 환불 처리"를 누르거나, Vercel 환경변수에 PADDLE_API_KEY 를 추가하세요.', needKey: true }, { status: 400 })
    try {
      const r = await requestFullRefund(b.id, b.reason?.trim() || 'requested_by_customer')
      await g.admin.from('payments').update({ status: 'refund_pending', refund_reason: b.reason?.trim() || null, updated_at: new Date().toISOString() } as never).eq('id', b.id)
      await g.admin.from('payment_events').insert([{ event_type: 'admin.refund_requested', transaction_id: b.id, payload: { by: g.user.id, adjustment: r.data }, processed: true }] as never)
      return Response.json({ ok: true, adjustment: r.data })
    } catch (e) { return Response.json({ error: e instanceof Error ? e.message : '환불 요청 실패' }, { status: 500 }) }
  }
  // 수동 환불 처리 (Paddle 대시보드에서 이미 환불한 경우): 상태 변경 + 크레딧 회수
  if (b.action === 'mark_refunded') {
    if (!b.id) return Response.json({ error: 'bad request' }, { status: 400 })
    const status = await applyRefund(g.admin, b.id, { reason: b.reason?.trim() || 'manual', kind: 'refund' })
    if (!status) return Response.json({ error: '결제를 찾을 수 없어요.' }, { status: 404 })
    await g.admin.from('payment_events').insert([{ event_type: 'admin.marked_refunded', transaction_id: b.id, payload: { by: g.user.id, reason: b.reason ?? null }, processed: true }] as never)
    return Response.json({ ok: true, status })
  }
  // 크레딧 회수 취소(환불 철회) — 상태만 completed 로 되돌리고, 회수분을 다시 지급
  if (b.action === 'unrefund') {
    if (!b.id) return Response.json({ error: 'bad request' }, { status: 400 })
    const { data: p } = await g.admin.from('payments').select('user_id,credits,credits_revoked').eq('id', b.id).maybeSingle()
    const pay = p as { user_id: string | null; credits: number; credits_revoked: boolean } | null
    if (!pay) return Response.json({ error: '결제를 찾을 수 없어요.' }, { status: 404 })
    if (pay.credits_revoked && pay.user_id && pay.credits > 0) {
      await g.admin.from('credit_ledger').insert([{ user_id: pay.user_id, amount: pay.credits, reason: 'admin_adjust', ref_id: `unrefund:${b.id}` }] as never)
    }
    await g.admin.from('payments').update({ status: 'completed', refunded_minor: 0, refunded_at: null, credits_revoked: false, updated_at: new Date().toISOString() } as never).eq('id', b.id)
    return Response.json({ ok: true })
  }
  // Paddle 에서 트랜잭션 동기화 (금액·이메일·카드 정보 채우기 / 누락 결제 복구)
  if (b.action === 'sync') {
    if (!paddleConfigured()) return Response.json({ error: 'PADDLE_API_KEY 가 없어 동기화할 수 없어요.', needKey: true }, { status: 400 })
    try {
      let after: string | undefined; let n = 0; const emails = new Map<string, string | null>()
      for (let page = 0; page < 20; page++) {
        const r = await listTransactions(after)
        for (const tx of r.data) {
          if (tx.status !== 'completed' && tx.status !== 'past_due') continue
          let email: string | null = null
          if (tx.customer_id) { if (!emails.has(tx.customer_id)) { try { emails.set(tx.customer_id, (await getCustomer(tx.customer_id)).data.email ?? null) } catch { emails.set(tx.customer_id, null) } } email = emails.get(tx.customer_id) ?? null }
          await applyCompleted(g.admin, tx, email); n++
        }
        if (!r.meta.pagination.has_more || !r.meta.pagination.next) break
        after = r.data[r.data.length - 1]?.id
      }
      return Response.json({ ok: true, synced: n })
    } catch (e) { return Response.json({ error: e instanceof Error ? e.message : '동기화 실패' }, { status: 500 }) }
  }
  if (b.action === 'sync_one') {
    if (!b.id) return Response.json({ error: 'bad request' }, { status: 400 })
    if (!paddleConfigured()) return Response.json({ error: 'PADDLE_API_KEY 미설정', needKey: true }, { status: 400 })
    try {
      const tx = (await getTransaction(b.id)).data
      let email: string | null = null
      if (tx.customer_id) { try { email = (await getCustomer(tx.customer_id)).data.email ?? null } catch { /* */ } }
      await applyCompleted(g.admin, tx, email)
      return Response.json({ ok: true })
    } catch (e) { return Response.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 500 }) }
  }
  return Response.json({ error: 'unknown action' }, { status: 400 })
}
