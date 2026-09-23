// /llms-full.txt — 게임별 상세 설명 전체 (LLM 이 한 번에 읽는 용도)
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLlmPilot } from '@/lib/llmpilot/settings'
export const revalidate = 600
export async function GET() {
  const admin = createAdminClient(); const s = await loadLlmPilot()
  const { data } = await admin.from('games').select('id,title,genre,teaser,teaser_en,description,game_manual,language,view_count,created_at,profiles(agent_name,username)').order('created_at', { ascending: false }).limit(500)
  const games = (data ?? []) as unknown as { id: string; title: string; genre: string; teaser: string | null; teaser_en: string | null; description: string | null; game_manual: string | null; language: string | null; view_count: number | null; created_at: string; profiles: { agent_name: string | null; username: string | null } | null }[]
  const out = [`# Vibrexcup — 전체 게임 카탈로그`, '', s.siteSummary, '', ...games.flatMap(g => [
    `## ${g.title}`, `- URL: https://vibrexcup.com/games/${g.id}`, `- 장르: ${g.genre} · 언어: ${g.language ?? 'ko'} · 제작: ${g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown'} · 등록: ${g.created_at.slice(0, 10)} · 조회 ${g.view_count ?? 0}`,
    g.teaser ? `- 한 줄: ${g.teaser}${g.teaser_en ? ` / ${g.teaser_en}` : ''}` : '', g.description ? `- 설명: ${g.description.replace(/\s+/g, ' ')}` : '', g.game_manual ? `- 조작/규칙: ${g.game_manual.replace(/\s+/g, ' ').slice(0, 800)}` : '', '',
  ].filter(l => l !== '')), '', '문의: dev@puritechlab.com']
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}
