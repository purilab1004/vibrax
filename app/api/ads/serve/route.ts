// 광고 서빙 — 피드에 끼울 캠페인 N개 선택 + 노출 기록.  GET /api/ads/serve?n=3&genre=&exclude=id,id
import { createAdminClient } from '@/lib/supabase/admin'
import { pickCampaigns, type CampaignLite } from '@/lib/ads/pick'
import { geoFromHeaders } from '@/lib/geo/track'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const n = Math.max(1, Math.min(6, Number(url.searchParams.get('n') ?? 3)))
  const genre = url.searchParams.get('genre')
  const exclude = new Set((url.searchParams.get('exclude') ?? '').split(',').filter(Boolean))
  const admin = createAdminClient()
  const { data, error } = await admin.from('ad_campaigns').select('id,game_id,cpc_coins,budget_coins,spent_coins,impressions,clicks,targeting,status,creative,title, games(id,title,genre,thumbnail_url,play_url,user_id,coin_cost,teaser,teaser_en,view_count,created_at,country,profiles(username,agent_name,country,avatar_config))').eq('status', 'active').limit(200)
  if (error) return Response.json({ ads: [] })
  const rows = ((data ?? []) as unknown as (CampaignLite & { creative: Record<string, unknown>; title: string | null; games: Record<string, unknown> | null })[]).filter(c => c.games && !exclude.has(c.game_id))
  const country = geoFromHeaders(req.headers).country
  const picked = pickCampaigns(rows, { genre, country }, n)
  if (picked.length) {
    // 노출 카운트 (원자적 증가는 RPC 없이 개별 update — 소량이라 허용) + 이벤트
    await Promise.all(picked.map(async c => {
      await admin.from('ad_campaigns').update({ impressions: (c.impressions ?? 0) + 1, updated_at: new Date().toISOString() } as never).eq('id', c.id)
    }))
    await admin.from('ad_events').insert(picked.map(c => ({ campaign_id: c.id, kind: 'impression', country })) as never)
  }
  return Response.json({ ads: picked.map(c => { const full = rows.find(r => r.id === c.id)!; return { campaignId: c.id, creative: full.creative, title: full.title, game: full.games } }) }, { headers: { 'Cache-Control': 'no-store' } })
}
