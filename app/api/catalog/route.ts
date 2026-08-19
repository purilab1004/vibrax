// 공개 JSON 카탈로그 — LLM/에이전트/파트너용 (읽기 전용)
import { createAdminClient } from '@/lib/supabase/admin'
export const revalidate = 600
export async function GET() {
  const { data } = await createAdminClient().from('games').select('id,title,genre,teaser,teaser_en,description,language,thumbnail_url,view_count,created_at,country').order('view_count', { ascending: false }).limit(500)
  const games = ((data ?? []) as Record<string, unknown>[]).map(g => ({ ...g, url: `https://vibrexcup.com/games/${g.id}`, play_free: true, platform: ['web', 'mobile-web'] }))
  return Response.json({ site: 'Vibrexcup', url: 'https://vibrexcup.com', updated_at: new Date().toISOString(), count: games.length, games }, { headers: { 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' } })
}
