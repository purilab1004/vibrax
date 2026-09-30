// STORY 서버 로직 — 첫 게시 때 1화, 업데이트로 새 지도·몬스터가 생기면 다음 화.
// LLM 호출은 주입식: 웹(프로덕션)은 apiLlm(API 크레딧), 로컬 스크립트는 claude -p(Max) 를 넘긴다.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  STORY_SOURCE, STORY_STATE_KEY, digestGame, planPrompt, detectPrompt, episodePrompt, parseJson,
  composeEpisodeHtml, storyExcerpt, mergeCovered, realAdditions,
  type StoryGame, type StoryPlan, type PlanEpisode, type DetectResult, type EpisodeDraft, type StoryCut, type StoryElement, type PrevEpisode, type StoryGameState,
} from './core'

export type LlmPurpose = 'plan' | 'detect' | 'write'
export type Llm = (prompt: string, opts: { maxTokens: number; purpose: LlmPurpose; gameId?: string }) => Promise<string>

// 게임별 연재 상태 — core 의 기본 상태 + 주인공·세계관(말투 일관성) + 아직 안 쓴 계획 회차
export interface SeriesState extends StoryGameState { hero?: string; world?: string; pending?: PlanEpisode[] }

const WRITE_MODEL = 'claude-sonnet-5'
const LIGHT_MODEL = 'claude-haiku-4-5-20251001'

export const apiLlm: Llm = async (prompt, { maxTokens, purpose, gameId }) => {
  const model = purpose === 'write' ? WRITE_MODEL : LIGHT_MODEL
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`story llm ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  try {
    const { logUsage } = await import('@/lib/llm/usage')
    void logUsage({ kind: 'story', model, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens, meta: { purpose, gameId } })
  } catch { /* 기록 실패는 무시 */ }
  return data.content?.find(c => c.type === 'text')?.text ?? ''
}

type GameRow = StoryGame & { studio_project_id: string | null; live_version_id?: string | null; thumbnail_url: string | null }

export async function loadStoryGame(sb: SupabaseClient, gameId: string): Promise<GameRow | null> {
  const { data } = await sb.from('games')
    .select('id,title,genre,description,intro,teaser,game_manual,studio_project_id,live_version_id,thumbnail_url')
    .eq('id', gameId).maybeSingle()
  return data as GameRow | null
}

/** 지금 서빙 중인 버전의 HTML — /play 와 같은 규칙(live_version, 없으면 사람이 만든 최신) */
export async function loadGameHtml(sb: SupabaseClient, g: GameRow): Promise<{ html: string; versionId: string | null }> {
  if (!g.studio_project_id) return { html: '', versionId: null }
  type V = { id: string; html: string }
  let v: V | null = null
  if (g.live_version_id) v = (await sb.from('studio_versions').select('id,html').eq('id', g.live_version_id).maybeSingle()).data as V | null
  if (!v) v = (await sb.from('studio_versions').select('id,html').eq('project_id', g.studio_project_id).neq('origin', 'auto').order('version', { ascending: false }).limit(1).maybeSingle()).data as V | null
  return { html: v?.html ?? '', versionId: v?.id ?? null }
}

export async function loadState(sb: SupabaseClient): Promise<Record<string, SeriesState>> {
  const { data } = await sb.from('site_settings').select('value').eq('key', STORY_STATE_KEY).maybeSingle()
  return ((data as { value?: Record<string, SeriesState> } | null)?.value ?? {}) as Record<string, SeriesState>
}

/** 한 게임 상태만 바꾼다 — 읽고 바로 쓰기(동시 실행이 드물어 잠금은 두지 않음) */
export async function saveGameState(sb: SupabaseClient, gameId: string, st: SeriesState | null): Promise<void> {
  const all = await loadState(sb)
  if (st) all[gameId] = st
  else delete all[gameId]
  await sb.from('site_settings').upsert({ key: STORY_STATE_KEY, value: all, updated_at: new Date().toISOString() } as never)
}

export async function listEpisodes(sb: SupabaseClient, gameId: string): Promise<PrevEpisode[]> {
  const { data } = await sb.from('blog_posts').select('id,title,excerpt,created_at')
    .eq('source', STORY_SOURCE).eq('game_id', gameId).order('created_at', { ascending: true })
  return ((data ?? []) as { title: string; excerpt: string }[]).map((p, i) => ({ no: i + 1, title: p.title, excerpt: p.excerpt }))
}

async function adminAuthorId(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error('no admin author')
  return id
}

/** 게임에 연결된 웹툰의 컷 — 크리에이터가 올린 웹툰이 있으면 회차 컷으로 쓴다 */
export async function webtoonCuts(sb: SupabaseClient, gameId: string, max = 3): Promise<StoryCut[]> {
  const { data } = await sb.from('webtoons').select('title,cuts').eq('game_id', gameId).eq('published', true).order('created_at', { ascending: false }).limit(2)
  const cuts: StoryCut[] = []
  for (const w of (data ?? []) as { title: string; cuts: { url: string }[] }[]) for (const c of w.cuts ?? []) if (c?.url && cuts.length < max) cuts.push({ url: c.url, caption: w.title })
  return cuts
}

export interface WriteArgs {
  game: GameRow; episodeNo: number; focus: StoryElement[]; hint?: string; hero?: string; world?: string
  prev: PrevEpisode[]; cuts: StoryCut[]; published: boolean; authorId?: string
}

export async function writeEpisode(sb: SupabaseClient, llm: Llm, a: WriteArgs): Promise<{ id: string; title: string }> {
  const prompt = episodePrompt({ game: a.game, episodeNo: a.episodeNo, hero: a.hero, world: a.world, focus: a.focus, hint: a.hint, prev: a.prev.slice(-4), cuts: a.cuts })
  let draft: EpisodeDraft | null = null
  for (let i = 0; i < 2 && !draft?.html; i++) draft = parseJson<EpisodeDraft>(await llm(prompt, { maxTokens: 4000, purpose: 'write', gameId: a.game.id }))
  if (!draft?.title || !draft.html) throw new Error('episode generation failed')
  const now = new Date().toISOString()
  const { data, error } = await sb.from('blog_posts').insert([{
    title: draft.title.replace(/^\s*\d+\s*화[.:\s]*/, '').slice(0, 120),
    content: composeEpisodeHtml(draft.html, a.cuts),
    excerpt: storyExcerpt(draft),
    published: a.published,
    published_at: a.published ? now : null,
    author_id: a.authorId ?? await adminAuthorId(sb),
    thumbnail_url: a.cuts[0]?.url ?? a.game.thumbnail_url ?? null,
    source: STORY_SOURCE,
    game_id: a.game.id,
  }] as never).select('id,title').single()
  if (error) throw new Error(error.message)
  return data as { id: string; title: string }
}

export async function makePlan(llm: Llm, game: GameRow, digest: string): Promise<StoryPlan> {
  const plan = parseJson<StoryPlan>(await llm(planPrompt(game, digest), { maxTokens: 2500, purpose: 'plan', gameId: game.id }))
  const episodes = plan?.episodes?.length ? plan.episodes : [{ focus: [], hint: '도입부' }]
  return { hero: plan?.hero ?? '', world: plan?.world ?? '', elements: plan?.elements ?? [], episodes }
}

/** 첫 게시 — 연재 계획을 세우고 1화를 쓴다. 남은 계획 회차는 pending 에 두고 하루 한 화씩 연재(cron) */
export async function startSeries(sb: SupabaseClient, llm: Llm, gameId: string, opts: { published: boolean; cuts?: StoryCut[] }): Promise<{ id: string; title: string } | null> {
  const game = await loadStoryGame(sb, gameId)
  if (!game) throw new Error('game not found')
  if ((await listEpisodes(sb, gameId)).length) return null   // 이미 연재 중(멱등)
  const { html, versionId } = await loadGameHtml(sb, game)
  const plan = await makePlan(llm, game, digestGame(html))
  const [first, ...rest] = plan.episodes
  const cuts = opts.cuts ?? await webtoonCuts(sb, gameId)
  const ep = await writeEpisode(sb, llm, { game, episodeNo: 1, focus: first.focus, hint: first.hint, hero: plan.hero, world: plan.world, prev: [], cuts, published: opts.published })
  // 인물은 1화부터 나온 것으로 치고, 지도·몬스터는 쓴 화의 focus 만 '나옴' 처리
  const covered = mergeCovered([], [...plan.elements.filter(e => e.kind === 'character'), ...first.focus])
  await saveGameState(sb, gameId, { version: versionId, covered, checkedAt: new Date().toISOString(), hero: plan.hero, world: plan.world, pending: rest })
  return ep
}

export type SyncResult = { gameId: string; action: 'started' | 'pending' | 'added' | 'unchanged' | 'no-new' | 'skipped'; episode?: string; detail?: string }

/**
 * 업데이트 동기화.
 *  - 연재가 없으면 시작(1화)
 *  - 서빙 버전이 바뀌었으면 새 지도·몬스터를 감지해 있으면 다음 화 (수치 조정 등은 건너뜀)
 *  - releasePending: 계획만 해 둔 회차가 있으면 한 화 연재 (하루 한 번 cron 에서)
 */
export async function syncSeries(sb: SupabaseClient, llm: Llm, gameId: string, opts: { published: boolean; releasePending?: boolean }): Promise<SyncResult> {
  const game = await loadStoryGame(sb, gameId)
  if (!game) return { gameId, action: 'skipped', detail: 'game not found' }
  const episodes = await listEpisodes(sb, gameId)
  if (!episodes.length) {
    const ep = await startSeries(sb, llm, gameId, { published: opts.published })
    return { gameId, action: 'started', episode: ep?.title }
  }
  const st: SeriesState = (await loadState(sb))[gameId] ?? { version: null, covered: [], checkedAt: '' }
  const { html, versionId } = await loadGameHtml(sb, game)

  if (versionId && versionId !== st.version && html) {
    const det = parseJson<DetectResult>(await llm(detectPrompt(game, digestGame(html), st.covered), { maxTokens: 1500, purpose: 'detect', gameId }))
    // 계획해 둔 회차에 이미 있던 요소는 '새로 생김'이 아니다 — pending 쪽에서 연재된다
    const planned = (st.pending ?? []).flatMap(p => p.focus)
    const added = realAdditions([...st.covered, ...planned.map(p => p.name)], det?.added ?? [])
    if (added.length) {
      const ep = await writeEpisode(sb, llm, { game, episodeNo: episodes.length + 1, focus: added, hero: st.hero, world: st.world, prev: episodes, cuts: [], published: opts.published })
      await saveGameState(sb, gameId, { ...st, version: versionId, covered: mergeCovered(st.covered, added), checkedAt: new Date().toISOString() })
      return { gameId, action: 'added', episode: ep.title, detail: added.map(a => a.name).join(', ') }
    }
    await saveGameState(sb, gameId, { ...st, version: versionId, checkedAt: new Date().toISOString() })
    if (!opts.releasePending || !st.pending?.length) return { gameId, action: 'no-new' }
    st.version = versionId
  }

  if (opts.releasePending && st.pending?.length) {
    const [next, ...rest] = st.pending
    const ep = await writeEpisode(sb, llm, { game, episodeNo: episodes.length + 1, focus: next.focus, hint: next.hint, hero: st.hero, world: st.world, prev: episodes, cuts: [], published: opts.published })
    await saveGameState(sb, gameId, { ...st, covered: mergeCovered(st.covered, next.focus), pending: rest, checkedAt: new Date().toISOString() })
    return { gameId, action: 'pending', episode: ep.title }
  }
  return { gameId, action: 'unchanged' }
}
