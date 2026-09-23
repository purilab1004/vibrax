// 내 결제 영수증(PDF) — 본인 결제만. Paddle 인보이스 URL 로 리다이렉트
import { createClient } from '@/lib/supabase/server'
import { getInvoiceUrl, paddleConfigured } from '@/lib/paddle/api'

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('bad request', { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const { data } = await supabase.from('payments').select('id,user_id,status').eq('id', id).maybeSingle()
  const p = data as { user_id: string | null; status: string } | null
  if (!p || p.user_id !== user.id) return new Response('not found', { status: 404 })
  if (!['completed', 'refunded', 'partially_refunded', 'refund_pending'].includes(p.status)) return new Response('영수증은 완료된 결제만 발급됩니다.', { status: 400 })
  if (!paddleConfigured()) return new Response('영수증 서비스가 아직 준비되지 않았어요.', { status: 503 })
  try { const r = await getInvoiceUrl(id); return Response.redirect(r.data.url, 302) } catch (e) { return new Response(e instanceof Error ? e.message : '영수증 조회 실패', { status: 500 }) }
}
