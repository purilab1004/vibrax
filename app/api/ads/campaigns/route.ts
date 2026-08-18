// 내 캠페인 목록 / 생성(예산 차감) / 상태 변경·충전·종료
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('ad_campaigns').select('*, games(id,title,thumbnail_url,genre)').eq('advertiser_id', user.id).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const { data: prof } = await supabase.from('profiles').select('vcoin').eq('id', user.id).maybeSingle()
  return Response.json({ campaigns: data ?? [], vcoin: (prof as { vcoin?: number } | null)?.vcoin ?? 0 })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { gameId?: string; budget?: number; cpc?: number; title?: string; creative?: unknown; targeting?: unknown; auto?: boolean } | null
  if (!b?.gameId || !b.budget) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data, error } = await supabase.rpc('create_ad_campaign', { p_game_id: b.gameId, p_budget: Math.floor(b.budget), p_cpc: Math.max(1, Math.floor(b.cpc ?? 1)), p_title: b.title ?? null, p_creative: b.creative ?? {}, p_targeting: b.targeting ?? {}, p_auto: !!b.auto } as never)
  if (error) {
    const msg = error.message.includes('insufficient_vcoin') ? '코인이 부족해요.' : error.message.includes('min_budget') ? '최소 예산은 10코인이에요.' : error.message
    return Response.json({ error: msg, missing: /does not exist|schema cache/i.test(error.message) }, { status: 400 })
  }
  return Response.json({ id: data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { id?: string; action?: 'pause' | 'resume' | 'close' | 'fund'; coins?: number } | null
  if (!b?.id || !b.action) return Response.json({ error: 'bad request' }, { status: 400 })
  if (b.action === 'fund') {
    const { data, error } = await supabase.rpc('fund_ad_campaign', { p_campaign_id: b.id, p_coins: Math.floor(b.coins ?? 0) } as never)
    if (error) return Response.json({ error: error.message.includes('insufficient') ? '코인이 부족해요.' : error.message }, { status: 400 })
    return Response.json({ budget: data })
  }
  if (b.action === 'close') {
    const { data, error } = await supabase.rpc('close_ad_campaign', { p_campaign_id: b.id } as never)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ refunded: data })
  }
  const { error } = await supabase.from('ad_campaigns').update({ status: b.action === 'pause' ? 'paused' : 'active', updated_at: new Date().toISOString() } as never).eq('id', b.id).eq('advertiser_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
