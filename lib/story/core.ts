// STORY — 게임별 연재 웹소설(+웹툰 컷). 서버·로컬 스크립트가 함께 쓰는 순수 로직(프롬프트·파싱·본문 조립).
// 저장: blog_posts(source='story', game_id) 한 행 = 한 화. 화 번호는 같은 게임 안에서 created_at 순서.
// 게임별 진행 상태(어떤 지도·몬스터까지 이야기에 나왔는지)는 site_settings.story_state[gameId].

export const STORY_SOURCE = 'story'
export const STORY_STATE_KEY = 'story_state'

export type ElementKind = 'map' | 'monster' | 'boss' | 'character' | 'stage'
export interface StoryElement { kind: ElementKind; name: string }
export interface StoryGameState { version: string | null; covered: string[]; checkedAt: string }
export type StoryState = Record<string, StoryGameState>
export interface StoryCut { url: string; caption?: string }

export interface StoryGame {
  id: string
  title: string
  genre?: string | null
  description?: string | null
  intro?: string | null
  teaser?: string | null
  game_manual?: string | null
}

export interface PrevEpisode { no: number; title: string; excerpt: string }

// ── 게임 HTML → 이야기 재료 요약 ──────────────────────────────────────────────
// HTML 은 수백 KB(이미지 base64 포함)라 그대로 LLM 에 넣지 않는다.
// 이름·대사·지도/몬스터 정의처럼 이야기에 쓸 만한 줄만 골라 최대 maxChars 로 줄인다.
const STORY_LINE_RE = /(name|title|label|text|msg|message|dialog|story|desc|stage|level|map|world|zone|boss|monster|enemy|mob|npc|hero|player|item|weapon|quest|스테이지|레벨|지도|맵|보스|몬스터|적|주인공|마을|던전|동굴|성|숲|아이템|퀘스트)/i
const HANGUL_RE = /[가-힣]/

export function digestGame(html: string, maxChars = 24000): string {
  const cleaned = html
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'DATA')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  const picked: string[] = []
  const seen = new Set<string>()
  let size = 0
  for (const raw of lines) {
    const l = raw.length > 240 ? raw.slice(0, 240) : raw
    if (!(HANGUL_RE.test(l) || STORY_LINE_RE.test(l))) continue
    if (/^(\/\/|\*|\/\*)?\s*$/.test(l) || seen.has(l)) continue
    seen.add(l)
    picked.push(l)
    size += l.length + 1
    if (size > maxChars) break
  }
  return picked.join('\n')
}

function gameBlock(g: StoryGame): string {
  return [
    `게임 제목: ${g.title}`,
    g.genre ? `장르: ${g.genre}` : null,
    g.intro ? `한 줄 소개: ${g.intro}` : null,
    g.teaser ? `훅 문구: ${g.teaser}` : null,
    g.description ? `설명: ${g.description.slice(0, 800)}` : null,
    g.game_manual ? `게임 메뉴얼(일부): ${g.game_manual.slice(0, 1500)}` : null,
  ].filter(Boolean).join('\n')
}

// ── 1) 연재 계획(처음 만들 때) — 지도가 여러 개면 지도 순서대로 여러 화 ─────────────
export interface PlanEpisode { focus: StoryElement[]; hint: string }
export interface StoryPlan { hero: string; world: string; elements: StoryElement[]; episodes: PlanEpisode[] }

export function planPrompt(g: StoryGame, digest: string, maxEpisodes = 10): string {
  return [
    'Vibrexcup(AI 게임 플랫폼)의 게임을 "게임별 연재 웹소설"로 만들려고 해. 먼저 연재 계획을 세워줘.',
    gameBlock(g),
    '',
    '게임 코드에서 뽑은 이름·정의 줄(일부):',
    '```',
    digest,
    '```',
    '',
    '할 일:',
    '1. 이 게임의 이야기 요소를 뽑아: 지도/스테이지(map/stage), 일반 몬스터·적(monster), 보스(boss), 주요 인물·NPC(character). 코드에 실제로 있는 이름만, 게임 속 표기 그대로.',
    '2. 회차를 나눠: 1화는 도입부(주인공·세계관·첫 위기). 지도(또는 뚜렷이 다른 스테이지 구역)가 여러 개면 게임 속 진행 순서대로 지도 하나당 한 화. 지도가 하나뿐이면 1화만.',
    `   최대 ${maxEpisodes}화. 각 화의 focus 는 그 화에 처음 등장하는 지도·몬스터·보스.`,
    '3. 주인공(hero)과 세계관(world)을 한 문장씩 — 게임 속 설정이 없으면 게임 규칙에 어울리게 지어내도 된다.',
    '',
    '출력은 JSON 하나만(설명 없이):',
    '{"hero":"...","world":"...","elements":[{"kind":"map|stage|monster|boss|character","name":"..."}],"episodes":[{"focus":[{"kind":"map","name":"..."}],"hint":"이 화에서 일어날 일 한 줄"}]}',
  ].join('\n')
}

// ── 2) 업데이트 감지 — 새 지도·몬스터가 생겼는지 ──────────────────────────────
export interface DetectResult { elements: StoryElement[]; added: StoryElement[] }

export function detectPrompt(g: StoryGame, digest: string, covered: string[]): string {
  return [
    '게임이 수정됐어. 이미 연재 웹소설에 나온 요소 목록과 지금 게임 코드를 비교해서, 새로 생긴 "지도/스테이지" 또는 "몬스터/보스"가 있는지 찾아줘.',
    gameBlock(g),
    '',
    `이미 이야기에 나온 요소: ${covered.length ? covered.join(', ') : '(없음)'}`,
    '',
    '지금 게임 코드에서 뽑은 이름·정의 줄(일부):',
    '```',
    digest,
    '```',
    '',
    '규칙:',
    '- elements: 지금 게임의 지도/스테이지·몬스터·보스·주요 인물 전체. 이미 나온 요소와 같은 것이면 위 목록의 표기를 그대로 써.',
    '- added: elements 중 이미 나온 목록에 없는 지도/스테이지/몬스터/보스만. 수치 조정·버그 수정·UI 변경·아이템·색만 바뀐 건 넣지 마.',
    '- 확실하지 않으면 added 는 빈 배열.',
    '출력은 JSON 하나만: {"elements":[{"kind":"...","name":"..."}],"added":[{"kind":"map|stage|monster|boss","name":"..."}]}',
  ].join('\n')
}

// ── 3) 한 화 쓰기 ─────────────────────────────────────────────────────────────
export interface EpisodeInput {
  game: StoryGame
  episodeNo: number
  hero?: string
  world?: string
  focus: StoryElement[]
  hint?: string
  prev: PrevEpisode[]
  cuts: StoryCut[]
  isLast?: boolean
}
export interface EpisodeDraft { title: string; excerpt: string; html: string }

export function episodePrompt(e: EpisodeInput): string {
  const first = e.episodeNo === 1
  return [
    `게임 "${e.game.title}"의 연재 웹소설 ${e.episodeNo}화를 한국어로 써줘. 한국 웹소설 플랫폼(리디·카카오페이지) 연재 문체.`,
    gameBlock(e.game),
    e.hero ? `주인공: ${e.hero}` : null,
    e.world ? `세계관: ${e.world}` : null,
    e.prev.length ? `지난 화:\n${e.prev.map(p => `- ${p.no}화 「${p.title}」 ${p.excerpt}`).join('\n')}` : null,
    e.focus.length ? `이번 화에 처음 등장하는 것: ${e.focus.map(f => `${f.name}(${f.kind})`).join(', ')}` : null,
    e.hint ? `이번 화 방향: ${e.hint}` : null,
    '',
    '규칙:',
    first
      ? '- 1화는 도입부: 주인공 소개 → 세계관 → 첫 위기. 독자가 이 게임을 당장 해 보고 싶어지게.'
      : '- 지난 화에서 자연스럽게 이어서, 이번 화의 새 지도·몬스터와 마주치는 이야기.',
    '- 게임의 실제 규칙·조작·목표를 이야기 속 사건으로 녹여라(예: 점프해 발판을 오른다 → 주인공이 무너지는 발판을 뛰어오른다).',
    '- 짧은 문단, 대사와 긴장감, 마지막 문단은 다음이 궁금해지는 절단(클리프행어).',
    '- 1200~2000자. 문단 8~16개.',
    e.cuts.length
      ? `- 웹툰 컷 ${e.cuts.length}장을 본문 사이에 넣는다. 컷이 들어갈 자리에 단독 문단으로 [[CUT:1]] ... [[CUT:${e.cuts.length}]] 를 순서대로 한 번씩. 각 컷 설명: ${e.cuts.map((c, i) => `${i + 1}=${c.caption ?? '게임 장면'}`).join(', ')}`
      : null,
    '- html 은 <p>, <strong>, <em> 만 사용. 대사는 <p>"…"</p>.',
    '- title 은 "N화" 없이 회차 제목만(예: "용의 둥지에서 보석 드래곤을 만나다"). 25자 이내.',
    '- excerpt 는 다음 화가 궁금해지는 한 줄(70자 이내).',
    '출력은 JSON 하나만: {"title":"...","excerpt":"...","html":"<p>...</p>"}',
  ].filter(v => v !== null).join('\n')
}

// ── 파싱·조립 ──────────────────────────────────────────────────────────────────
export function parseJson<T>(text: string): T | null {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try { return JSON.parse(t.slice(s, e + 1)) as T } catch { return null }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function cutFigure(c: StoryCut): string {
  return `<figure class="story-cut"><img src="${esc(c.url)}" alt="${esc(c.caption ?? '')}" loading="lazy" />${c.caption ? `<figcaption>${esc(c.caption)}</figcaption>` : ''}</figure>`
}

/** 본문의 [[CUT:n]] 자리에 컷 이미지를 넣는다. 자리를 못 받은 컷은 적당한 간격으로 끼워 넣는다 */
export function composeEpisodeHtml(html: string, cuts: StoryCut[]): string {
  const used = new Set<number>()
  let out = html.replace(/<p>\s*\[\[CUT:(\d+)\]\]\s*<\/p>|\[\[CUT:(\d+)\]\]/g, (_m, a, b) => {
    const i = Number(a ?? b) - 1
    if (!cuts[i] || used.has(i)) return ''
    used.add(i)
    return cutFigure(cuts[i])
  })
  const left = cuts.filter((_, i) => !used.has(i))
  if (left.length) {
    const paras = out.split(/(?<=<\/p>)/)
    const step = Math.max(1, Math.floor(paras.length / (left.length + 1)))
    left.forEach((c, k) => { const at = Math.min(paras.length, step * (k + 1)); paras[at - 1] = (paras[at - 1] ?? '') + cutFigure(c) })
    out = paras.join('')
  }
  return out
}

export function storyExcerpt(draft: EpisodeDraft): string {
  return (draft.excerpt || draft.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 160)
}

/** 요소 이름 정규화 — 공백·기호 차이로 같은 몬스터를 새것으로 잡지 않게 */
export const normName = (s: string) => s.replace(/[\s·\-_:()[\]'"]/g, '').toLowerCase()

export function mergeCovered(covered: string[], add: StoryElement[]): string[] {
  const have = new Set(covered.map(normName))
  const out = [...covered]
  for (const e of add) if (!have.has(normName(e.name))) { have.add(normName(e.name)); out.push(e.name) }
  return out
}

/** LLM 이 준 added 중 정말 새로운(이미 나온 목록에 없는) 지도·몬스터만 */
export function realAdditions(covered: string[], added: StoryElement[]): StoryElement[] {
  const have = new Set(covered.map(normName))
  return added.filter(e => ['map', 'stage', 'monster', 'boss'].includes(e.kind) && e.name && !have.has(normName(e.name)))
}
