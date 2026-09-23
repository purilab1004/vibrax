// 코인 잭팟 — 공개 목록(진행 중 + 최근 3일 안에 추첨 끝난 것). 쇼츠 카드가 쓴다
//  · 상품은 추첨 전엔 "상품이 등록되었습니다!"만 — 이름·이미지는 추첨(당첨 발표) 뒤에 판도라 박스로 공개
//  · 추첨 끝난 잭팟은 당첨자 이름·상품 여부를 함께 준다
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

type J = { id: string; title: string; description: string | null; image_url: string | null; entry_cost: number; ends_at: string; status: string; pool: number; entries: number; drawn_at: string | null; product_id?: string | null; product_threshold?: number; winner_count?: number; winner_user_id?: string | null; hidden?: boolean }

export async function GET() {
  try {
    const admin = createAdminClient()
    const since = new Date(Date.now() - 3 * 86400000).toISOString()
    const [{ data: open }, { data: drawn }] = await Promise.all([
      admin.from('jackpots').select('*').eq('status', 'open').order('ends_at', { ascending: true }).limit(10),
      admin.from('jackpots').select('*').eq('status', 'drawn').gte('drawn_at', since).order('drawn_at', { ascending: false }).limit(5),
    ])
    const rows = [...((open ?? []) as J[]), ...((drawn ?? []) as J[])].filter((j) => !j.hidden)   // 관리자가 숨긴 잭팟 제외
    const drawnIds = rows.filter((j) => j.status === 'drawn').map((j) => j.id)
    // 당첨자 (v2 테이블이 없으면 winner_user_id 1명으로 폴백)
    const winnersBy: Record<string, { rank: number; user_id: string; prize: string }[]> = {}
    if (drawnIds.length) {
      const w = await admin.from('jackpot_winners').select('jackpot_id,rank,user_id,prize').in('jackpot_id', drawnIds).order('rank')
      if (!w.error) for (const r of (w.data ?? []) as { jackpot_id: string; rank: number; user_id: string; prize: string }[]) (winnersBy[r.jackpot_id] ??= []).push(r)
      else for (const j of rows) if (j.status === 'drawn' && j.winner_user_id) winnersBy[j.id] = [{ rank: 1, user_id: j.winner_user_id, prize: 'credits' }]
    }
    const userIds = [...new Set(Object.values(winnersBy).flat().map((w) => w.user_id))]
    const names: Record<string, string> = {}
    if (userIds.length) { const { data: profs } = await admin.from('profiles').select('id,username,agent_name').in('id', userIds); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null }[]) names[p.id] = p.agent_name ?? p.username ?? '회원' }
    // 공개할 상품 (추첨 끝난 잭팟의 상품만)
    const revealIds = [...new Set(rows.filter((j) => j.status === 'drawn' && j.product_id).map((j) => j.product_id as string))]
    const products: Record<string, { title: string; description: string | null; image_url: string | null }> = {}
    if (revealIds.length) { const { data: ps } = await admin.from('products').select('id,title,description,image_url').in('id', revealIds); for (const p of (ps ?? []) as { id: string; title: string; description: string | null; image_url: string | null }[]) products[p.id] = p }

    const items = rows.map((j) => {
      const ws = winnersBy[j.id] ?? []
      return {
        id: j.id, title: j.title, description: j.description, image_url: j.image_url, entry_cost: j.entry_cost, ends_at: j.ends_at, status: j.status, pool: j.pool, entries: j.entries, drawn_at: j.drawn_at,
        winner_count: j.winner_count ?? 1,
        has_product: !!j.product_id,
        product_threshold: j.product_threshold ?? 0,
        product: j.status === 'drawn' && j.product_id ? products[j.product_id] ?? null : null,
        product_won: ws.some((w) => w.prize === 'product'),
        winners: ws.map((w) => ({ rank: w.rank, name: names[w.user_id] ?? '회원', prize: w.prize })),
      }
    })
    // 내 참여 수 (로그인 시)
    const mine: Record<string, number> = {}
    try {
      const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
      if (user && items.length) { const { data: ent } = await admin.from('jackpot_entries').select('jackpot_id').eq('user_id', user.id).in('jackpot_id', items.map((j) => j.id)); for (const e of (ent ?? []) as { jackpot_id: string }[]) mine[e.jackpot_id] = (mine[e.jackpot_id] ?? 0) + 1 }
    } catch { /* guest */ }
    return Response.json({ open: items, mine }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return Response.json({ open: [], mine: {}, error: e instanceof Error ? e.message : 'error' }) }
}
