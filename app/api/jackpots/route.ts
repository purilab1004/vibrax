// 코인 잭팟 — 공개 목록(진행 중 + 최근 추첨) + 코인으로 살 수 있는 상품 몇 개. 쇼츠 카드·잭팟 페이지가 쓴다
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0
export async function GET() {
  try {
    const admin = createAdminClient()
    const [{ data: open }, { data: recent }, { data: products }] = await Promise.all([
      admin.from('jackpots').select('id,title,description,image_url,entry_cost,ends_at,status,pool,entries,created_at').eq('status', 'open').order('ends_at', { ascending: true }).limit(10),
      admin.from('jackpots').select('id,title,image_url,pool,entries,status,drawn_at,winner_user_id').in('status', ['drawn']).order('drawn_at', { ascending: false }).limit(5),
      admin.from('products').select('id,title,description,image_url,coin_price').eq('active', true).order('sort').limit(8),
    ])
    // 당첨자 이름
    const winners: Record<string, string> = {}
    const ids = (recent ?? []).map((j) => (j as { winner_user_id: string | null }).winner_user_id).filter((x): x is string => !!x)
    if (ids.length) { const { data: profs } = await admin.from('profiles').select('id,username,agent_name').in('id', ids); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null }[]) winners[p.id] = p.agent_name ?? p.username ?? '회원' }
    // 내 참여 수 (로그인 시)
    let mine: Record<string, number> = {}
    try {
      const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
      if (user && (open ?? []).length) { const { data: ent } = await admin.from('jackpot_entries').select('jackpot_id').eq('user_id', user.id).in('jackpot_id', (open ?? []).map((j) => (j as { id: string }).id)); mine = {}; for (const e of (ent ?? []) as { jackpot_id: string }[]) mine[e.jackpot_id] = (mine[e.jackpot_id] ?? 0) + 1 }
    } catch { /* guest */ }
    return Response.json({ open: open ?? [], recent: (recent ?? []).map((j) => ({ ...(j as object), winner_name: winners[(j as { winner_user_id: string | null }).winner_user_id ?? ''] ?? null })), products: products ?? [], mine }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return Response.json({ open: [], recent: [], products: [], mine: {}, error: e instanceof Error ? e.message : 'error' }) }
}
