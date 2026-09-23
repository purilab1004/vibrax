// 공개 JSON 카탈로그 — LLM/에이전트/파트너용 (읽기 전용)
import { embedUrlOf } from '@/lib/aj/external'
import { createAdminClient } from '@/lib/supabase/admin'
export const revalidate = 600
export async function GET() {
  const { data } = await createAdminClient().from('games').select('id,title,genre,teaser,teaser_en,description,language,thumbnail_url,view_count,created_at,country,studio_project_id,play_url').order('view_count', { ascending: false }).limit(500)
  const games = ((data ?? []) as Record<string, unknown>[]).map(g => ({ ...g, url: `https://vibrexcup.com/games/${g.id}`, embed_url: embedUrlOf(g.studio_project_id as string | null, g.play_url as string | null, g.id as string), play_free: true, platform: ['web', 'mobile-web'] }))
  return Response.json({ site: 'Vibrexcup', url: 'https://vibrexcup.com', updated_at: new Date().toISOString(), count: games.length, games }, { headers: { 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' } })
}
