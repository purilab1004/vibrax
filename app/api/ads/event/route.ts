// 광고 이벤트 — click(과금) / play / coin(귀속).  POST { campaignId, kind, coins? }
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geoFromHeaders } from '@/lib/geo/track'

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { campaignId?: string; kind?: 'click' | 'play' | 'coin'; coins?: number } | null
  if (!b?.campaignId || !['click', 'play', 'coin'].includes(b.kind ?? '')) return new Response('bad request', { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const { data: c } = await admin.from('ad_campaigns').select('id,cpc_coins,budget_coins,spent_coins,clicks,plays,coins_earned,status').eq('id', b.campaignId).maybeSingle()
  const camp = c as { id: string; cpc_coins: number; budget_coins: number; spent_coins: number; clicks: number; plays: number; coins_earned: number; status: string } | null
  if (!camp) return new Response(null, { status: 204 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let coins = 0
  if (b.kind === 'click') {
    if (camp.status !== 'active') return new Response(null, { status: 204 })
    // 같은 사용자의 중복 클릭(10분) 은 과금하지 않음
    if (user) {
      const { data: dup } = await admin.from('ad_events').select('id').eq('campaign_id', camp.id).eq('kind', 'click').eq('user_id', user.id).gte('created_at', new Date(Date.now() - 600_000).toISOString()).limit(1)
      if (dup && dup.length) return new Response(null, { status: 204 })
    }
    const spent = camp.spent_coins + camp.cpc_coins
    patch.clicks = camp.clicks + 1; patch.spent_coins = Math.min(spent, camp.budget_coins); coins = camp.cpc_coins
    if (spent >= camp.budget_coins) patch.status = 'done'
  } else if (b.kind === 'play') { patch.plays = camp.plays + 1 }
  else { coins = Math.max(0, Number(b.coins) || 0); patch.coins_earned = camp.coins_earned + coins }
  await admin.from('ad_campaigns').update(patch as never).eq('id', camp.id)
  await admin.from('ad_events').insert([{ campaign_id: camp.id, kind: b.kind, user_id: user?.id ?? null, coins, country: geoFromHeaders(req.headers).country }] as never)
  return new Response(null, { status: 204 })
}
