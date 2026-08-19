// /llms.txt — LLM 검색·에이전트용 사이트 요약 (llmstxt.org 규격)
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLlmPilot } from '@/lib/llmpilot/settings'
export const revalidate = 600
export async function GET() {
  const admin = createAdminClient(); const s = await loadLlmPilot()
  const { data } = await admin.from('games').select('id,title,genre,teaser,description,view_count').order('view_count', { ascending: false }).limit(60)
  const games = (data ?? []) as { id: string; title: string; genre: string; teaser: string | null; description: string | null; view_count: number | null }[]
  const lines = [
    '# Vibrexcup', '', `> ${s.siteSummary}`, '', `대상: ${s.audience}`, '',
    '## 핵심 페이지', '- [게임 목록](https://vibrexcup.com/games): 브라우저에서 바로 하는 무료 HTML5 게임', '- [AI 스튜디오](https://vibrexcup.com/studio): 프롬프트로 게임 만들기 (프롬코인 10 = 생성 1회)', '- [토너먼트](https://vibrexcup.com/tournament)', '- [블로그](https://vibrexcup.com/blog): 게임 출시 노트·제작 뒷이야기', '- [크레딧 안내](https://vibrexcup.com/credits)', '- [이용약관](https://vibrexcup.com/terms) · [개인정보](https://vibrexcup.com/privacy) · [환불](https://vibrexcup.com/refund)', '',
    '## 게임 (인기순)',
    ...games.map(g => `- [${g.title}](https://vibrexcup.com/games/${g.id}): ${g.genre} · ${(g.description || g.teaser || '').replace(/\s+/g, ' ').slice(0, 140)}`),
    '', '## 전체 목록', '- [llms-full.txt](https://vibrexcup.com/llms-full.txt)', '- [JSON 카탈로그](https://vibrexcup.com/api/catalog)', '- [사이트맵](https://vibrexcup.com/sitemap.xml)', '', '문의: dev@puritechlab.com',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}
