// MLPilot v2 — AJ 대화 학습 엔진 (서버 전용)
// 예시·규칙 지식베이스를 읽어 AJ system prompt 에 주입하고, 발화를 피드백으로 기록한다. 설계: docs/superpowers/specs/2026-08-19-mlpilot-aj-talk-design.md
import { createAdminClient } from '@/lib/supabase/admin'

export const SITUATIONS = ['intro', 'commentary', 'reply', 'agent_reply', 'event_start', 'event_score', 'event_combo', 'event_fail', 'event_over', 'event_clear', 'event_level', 'hype', 'comfort', 'tease', 'ad', 'greeting', 'farewell'] as const
export const EMOTIONS = ['excited', 'calm', 'empathy', 'funny', 'urgent', 'proud', 'sad', 'curious', 'warm'] as const
export const RULE_KINDS = ['persona', 'empathy', 'style', 'dont', 'scenario'] as const
export type Situation = typeof SITUATIONS[number]
export type Emotion = typeof EMOTIONS[number]
export const SITUATION_LABEL: Record<Situation, string> = { intro: '방송 시작 인사', commentary: '자동 중계', reply: '시청자 답변', agent_reply: '에이전트 답변', event_start: '게임 시작', event_score: '득점', event_combo: '콤보', event_fail: '실수/실패', event_over: '게임 오버', event_clear: '최종 클리어', event_level: '레벨 업', hype: '분위기 띄우기', comfort: '위로/공감', tease: '장난/놀리기', ad: '광고 멘트', greeting: '인사', farewell: '마무리' }
export const EMOTION_LABEL: Record<Emotion, string> = { excited: '신남', calm: '차분', empathy: '공감', funny: '웃김', urgent: '긴박', proud: '자랑스러움', sad: '아쉬움', curious: '호기심', warm: '따뜻함' }

export interface TalkExample { id: string; genre: string | null; game_id: string | null; situation: string; emotion: string | null; trigger_text: string | null; utterance: string; lang: string | null; tags: string[]; quality: number; uses: number; approved: boolean; source: string; created_at: string }
export interface TalkRule { id: string; scope: 'global' | 'genre' | 'game'; genre: string | null; game_id: string | null; kind: string; title: string | null; content: string; priority: number; enabled: boolean }
export interface TalkSettings { enabled: boolean; maxExamples: number; maxRuleChars: number; logSample: number; ingestKey: string | null; labelModel: string }
export const DEFAULT_TALK: TalkSettings = { enabled: true, maxExamples: 6, maxRuleChars: 1200, logSample: 0.5, ingestKey: null, labelModel: 'claude-haiku-4-5' }

let setCache: { at: number; v: TalkSettings } | null = null
export async function loadTalkSettings(): Promise<TalkSettings> {
  if (setCache && Date.now() - setCache.at < 60_000) return setCache.v
  try { const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'mlpilot_talk').maybeSingle(); const v = { ...DEFAULT_TALK, ...(((data as { value?: Partial<TalkSettings> } | null)?.value) ?? {}) }; setCache = { at: Date.now(), v }; return v } catch { return DEFAULT_TALK }
}
export async function saveTalkSettings(p: Partial<TalkSettings>) { const cur = await loadTalkSettings(); const v = { ...cur, ...p }; await createAdminClient().from('site_settings').upsert({ key: 'mlpilot_talk', value: v, updated_at: new Date().toISOString() } as never); setCache = null; return v }

// 지식베이스 캐시 (60초) — 런타임 채팅은 초당 여러 번 호출되므로 DB 를 매번 치지 않는다
let kb: { at: number; examples: TalkExample[]; rules: TalkRule[] } | null = null
export function invalidateTalkKb() { kb = null }
async function loadKb() {
  if (kb && Date.now() - kb.at < 60_000) return kb
  try {
    const admin = createAdminClient()
    const [{ data: ex }, { data: ru }] = await Promise.all([
      admin.from('aj_talk_examples').select('id,genre,game_id,situation,emotion,trigger_text,utterance,lang,tags,quality,uses,approved,source,created_at').eq('approved', true).order('quality', { ascending: false }).limit(3000),
      admin.from('aj_talk_rules').select('id,scope,genre,game_id,kind,title,content,priority,enabled').eq('enabled', true).order('priority', { ascending: false }).limit(300),
    ])
    kb = { at: Date.now(), examples: (ex ?? []) as TalkExample[], rules: (ru ?? []) as TalkRule[] }
  } catch { kb = { at: Date.now(), examples: [], rules: [] } }
  return kb
}

/** 상대(시청자) 말투 감지 — 언어·존댓말·텐션 */
export function detectViewerStyle(text: string | null | undefined) {
  const t = (text ?? '').trim()
  if (!t) return null
  const ko = /[가-힣]/.test(t)
  const polite = ko && /(요|니다|세요|습니까|까요)[.!?~ ]*$/.test(t)
  const shout = (t.match(/[!]{2,}|ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|\?\?/g) ?? []).length > 0 || t === t.toUpperCase() && /[A-Z]{4,}/.test(t)
  const sad = /ㅠ|ㅜ|망했|죽었|실패|못하겠|힘들|짜증|아쉽|sad|fail|lost|died|ugh/i.test(t)
  const angry = /짜증|화나|열받|빡|개같|wtf|angry|hate/i.test(t)
  return { lang: ko ? 'ko' : 'en', polite, tension: shout ? 'high' : 'normal', mood: angry ? 'angry' : sad ? 'down' : 'neutral' }
}

/** 상황·감정·장르에 맞는 예시와 규칙을 골라 system prompt 조각을 만든다 */
export async function buildTalkContext(p: { genre: string; gameId?: string | null; situation: Situation | string; emotion?: Emotion | string | null; viewerText?: string | null }) {
  const settings = await loadTalkSettings()
  if (!settings.enabled) return { text: '', exampleIds: [] as string[], ruleIds: [] as string[], style: null as ReturnType<typeof detectViewerStyle> }
  const { examples, rules } = await loadKb()
  const style = detectViewerStyle(p.viewerText)
  // 감정 추론: 명시 없으면 상황·상대 무드로
  const emotion = p.emotion ?? (style?.mood === 'down' ? 'empathy' : style?.mood === 'angry' ? 'calm' : p.situation === 'event_fail' || p.situation === 'event_over' ? 'empathy' : p.situation === 'event_score' || p.situation === 'event_combo' || p.situation === 'hype' ? 'excited' : p.situation === 'event_clear' ? 'proud' : null)
  // 규칙: global → genre → game 순, 우선순위 높은 것부터, 글자 예산 내
  const picked: TalkRule[] = []
  let chars = 0
  for (const r of [...rules.filter(r => r.scope === 'game' && r.game_id === p.gameId), ...rules.filter(r => r.scope === 'genre' && r.genre === p.genre), ...rules.filter(r => r.scope === 'global')]) {
    if (chars + r.content.length > settings.maxRuleChars) continue
    picked.push(r); chars += r.content.length
  }
  // 예시: 점수 = 상황 일치(3) + 감정 일치(1.5) + 장르 일치(1) + 게임 일치(2) + 언어 일치(1) + 품질(0~2) + 무작위(0~0.8)
  const scored = examples.map(e => {
    let s = 0
    if (e.situation === p.situation) s += 3; else if ((e.situation.startsWith('event_') && String(p.situation).startsWith('event_')) || (e.situation === 'commentary' && p.situation === 'intro')) s += 0.8
    if (emotion && e.emotion === emotion) s += 1.5
    if (e.genre === p.genre) s += 1; else if (e.genre) s -= 0.5
    if (p.gameId && e.game_id === p.gameId) s += 2
    if (style && e.lang === style.lang) s += 1
    s += e.quality * 2 + Math.random() * 0.8
    return { e, s }
  }).filter(x => x.s > 2.5).sort((a, b) => b.s - a.s).slice(0, settings.maxExamples)
  const ex = scored.map(x => x.e)
  const lines: string[] = []
  if (picked.length) lines.push('[말하기 가이드]\n' + picked.map(r => `- (${r.kind}${r.title ? ` · ${r.title}` : ''}) ${r.content.trim()}`).join('\n'))
  if (style) lines.push(`[상대 말투] 언어=${style.lang}, ${style.polite ? '존댓말' : '반말/캐주얼'}, 텐션=${style.tension}, 기분=${style.mood}. 같은 언어로, 기분이 down 이면 먼저 공감하고, angry 면 차분히 받아준다.`)
  if (emotion) lines.push(`[이번 발화의 감정 톤] ${emotion}`)
  if (ex.length) lines.push('[좋은 발화 예시 — 말투·길이·리듬을 참고하되 그대로 베끼지 말 것]\n' + ex.map(e => `- (${e.situation}${e.emotion ? `/${e.emotion}` : ''})${e.trigger_text ? ` 상황: ${e.trigger_text.slice(0, 80)} →` : ''} "${e.utterance.slice(0, 160)}"`).join('\n'))
  // 사용 카운트 (비동기, 실패 무시)
  if (ex.length) { const admin = createAdminClient(); void Promise.all(ex.map(e => admin.from('aj_talk_examples').update({ uses: e.uses + 1 } as never).eq('id', e.id))).catch(() => {}) }
  return { text: lines.join('\n\n'), exampleIds: ex.map(e => e.id), ruleIds: picked.map(r => r.id), style, emotion }
}

/** 발화 로그 (샘플링) — 학습 루프 입력 */
export async function logTalk(row: { gameId?: string | null; genre: string; situation: string; emotion?: string | null; viewerText?: string | null; utterance: string; exampleIds: string[]; ruleIds: string[] }) {
  try {
    const s = await loadTalkSettings()
    if (Math.random() > s.logSample) return
    await createAdminClient().from('aj_talk_feedback').insert([{ game_id: row.gameId ?? null, genre: row.genre, situation: row.situation, emotion: row.emotion ?? null, viewer_text: row.viewerText?.slice(0, 500) ?? null, utterance: row.utterance.slice(0, 1000), example_ids: row.exampleIds, rule_ids: row.ruleIds }] as never)
  } catch { /* ignore */ }
}
