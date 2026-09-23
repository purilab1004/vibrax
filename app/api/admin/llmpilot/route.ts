// LLMPilot — AI 검색(ChatGPT/Gemini/Claude/Perplexity) 노출 최적화 상태 점검 + 설정
import { requireAdmin } from '@/lib/admin/guard'
import { loadLlmPilot, saveLlmPilot, type LlmPilot } from '@/lib/llmpilot/settings'

const BASE = 'https://vibrexcup.com'
async function probe(path: string, ua?: string) {
  try { const r = await fetch(`${BASE}${path}`, { headers: ua ? { 'user-agent': ua } : {}, cache: 'no-store', redirect: 'manual' }); const text = r.status === 200 ? await r.text() : ''; return { status: r.status, len: text.length, text } } catch { return { status: 0, len: 0, text: '' } }
}

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const settings = await loadLlmPilot()
  const [{ data: games }, robots, llms, llmsFull, sitemap, catalog, home] = await Promise.all([
    g.admin.from('games').select('id,title,genre,teaser,teaser_en,description,game_manual,thumbnail_url,view_count').order('view_count', { ascending: false }).limit(500),
    probe('/robots.txt'), probe('/llms.txt'), probe('/llms-full.txt'), probe('/sitemap.xml'), probe('/api/catalog'), probe('/'),
  ])
  const gs = (games ?? []) as { id: string; title: string; genre: string; teaser: string | null; teaser_en: string | null; description: string | null; game_manual: string | null; thumbnail_url: string; view_count: number | null }[]
  const sample = gs[0] ? await probe(`/games/${gs[0].id}`) : { status: 0, len: 0, text: '' }
  const bots = ['ChatGPT-User', 'OAI-SearchBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Googlebot', 'GPTBot', 'ClaudeBot']
  const botAccess = await Promise.all(bots.map(async ua => ({ ua, status: (await probe('/games', `Mozilla/5.0 (compatible; ${ua}/1.0)`)).status })))
  const contentScore = (x: typeof gs[number]) => (x.description ? 40 : 0) + (x.teaser ? 20 : 0) + (x.game_manual ? 30 : 0) + (x.teaser_en ? 10 : 0)
  const checks = [
    { key: 'robots', label: 'robots.txt — AI 검색 봇 허용', ok: robots.status === 200 && /OAI-SearchBot/.test(robots.text), detail: robots.status === 200 ? (settings.allowUserBrowsing ? '검색 인덱서·사용자 브라우징 봇 허용, 학습 크롤러 차단' : '사용자 브라우징 봇 차단 중 — ChatGPT/Perplexity 가 답변할 때 페이지를 못 읽어요') : `HTTP ${robots.status}` },
    { key: 'llms', label: 'llms.txt (LLM 요약)', ok: llms.status === 200 && llms.len > 200, detail: `HTTP ${llms.status} · ${llms.len.toLocaleString()}자` },
    { key: 'llmsfull', label: 'llms-full.txt (전체 카탈로그)', ok: llmsFull.status === 200 && llmsFull.len > 200, detail: `HTTP ${llmsFull.status} · ${llmsFull.len.toLocaleString()}자` },
    { key: 'catalog', label: 'JSON 카탈로그 (/api/catalog)', ok: catalog.status === 200, detail: `HTTP ${catalog.status}` },
    { key: 'sitemap', label: 'sitemap.xml', ok: sitemap.status === 200 && /games\//.test(sitemap.text), detail: `HTTP ${sitemap.status} · 게임 URL ${(sitemap.text.match(/\/games\//g) ?? []).length}개` },
    { key: 'jsonld', label: '게임 페이지 구조화 데이터 (VideoGame JSON-LD)', ok: /"@type":"VideoGame"/.test(sample.text), detail: gs[0] ? `${gs[0].title} 페이지 검사 · ${/"@type":"VideoGame"/.test(sample.text) ? '있음' : '없음'}` : '게임 없음' },
    { key: 'homeld', label: '홈 구조화 데이터 (WebSite/Organization)', ok: /application\/ld\+json/.test(home.text), detail: /application\/ld\+json/.test(home.text) ? '있음' : '없음' },
    { key: 'content', label: '게임 설명 완성도 (설명·매뉴얼·티저)', ok: gs.length > 0 && gs.filter(x => contentScore(x) >= 60).length / Math.max(1, gs.length) >= 0.7, detail: `${gs.filter(x => contentScore(x) >= 60).length}/${gs.length} 게임이 60점 이상` },
  ]
  return Response.json({
    settings, checks, botAccess,
    games: gs.map(x => ({ id: x.id, title: x.title, genre: x.genre, score: contentScore(x), hasDesc: !!x.description, hasManual: !!x.game_manual, hasTeaser: !!x.teaser, hasTeaserEn: !!x.teaser_en, views: x.view_count ?? 0 })),
    score: Math.round((checks.filter(c => c.ok).length / checks.length) * 100),
  })
}
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as Partial<LlmPilot> | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  const v = await saveLlmPilot({ ...(typeof b.allowUserBrowsing === 'boolean' ? { allowUserBrowsing: b.allowUserBrowsing } : {}), ...(typeof b.allowTraining === 'boolean' ? { allowTraining: b.allowTraining } : {}), ...(typeof b.siteSummary === 'string' ? { siteSummary: b.siteSummary.slice(0, 1000) } : {}), ...(typeof b.audience === 'string' ? { audience: b.audience.slice(0, 300) } : {}) })
  return Response.json({ settings: v })
}
