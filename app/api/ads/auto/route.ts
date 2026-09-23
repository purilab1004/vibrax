// AJ 자동 크리에이티브 — 게임의 최신 AJ 리포트/티저로 광고 문구를 만든다 (LLM 호출 없이 즉시; 리포트 없으면 티저·제목 기반)
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { gameId?: string } | null
  if (!b?.gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const [{ data: g }, { data: rep }, { data: coins }] = await Promise.all([
    admin.from('games').select('id,title,genre,teaser,teaser_en,user_id,profiles(agent_name,username)').eq('id', b.gameId).maybeSingle(),
    admin.from('aj_reports').select('report').eq('game_id', b.gameId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('game_coin_events').select('coins').eq('game_id', b.gameId).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
  ])
  const game = g as unknown as { id: string; title: string; genre: string; teaser: string | null; teaser_en: string | null; user_id: string; profiles: { agent_name: string | null; username: string | null } | null } | null
  if (!game) return Response.json({ error: 'not found' }, { status: 404 })
  const report = (rep as { report?: { broadcast?: { thumbnail_title?: string; hooks?: string[]; opening?: string }; headline?: string; fun_score?: number } } | null)?.report
  const week = ((coins ?? []) as { coins: number }[]).reduce((a, x) => a + x.coins, 0)
  const ajName = game.profiles?.agent_name ?? `AJ ${game.profiles?.username ?? ''}`.trim()
  const creative = {
    by: 'aj',
    headline: report?.broadcast?.thumbnail_title ?? game.teaser ?? game.title,
    hook: report?.broadcast?.hooks?.[0] ?? report?.headline ?? game.teaser_en ?? '지금 바로 도전해 보세요',
    badge: `${ajName} PICK`,
    fun_score: report?.fun_score ?? null,
  }
  // 권장 예산: 최근 7일 코인 수익의 20% (최소 20, 최대 500) — 리인베스트 규칙
  const suggestedBudget = Math.max(20, Math.min(500, Math.round(week * 0.2)))
  const suggestedCpc = week > 100 ? 2 : 1
  return Response.json({ creative, suggestedBudget, suggestedCpc, weekCoins: week, ajName })
}
