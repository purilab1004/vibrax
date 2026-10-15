import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { matchTemplateIn } from '@/lib/studio/template-match'
import { effectiveStaticTemplates } from '@/lib/studio/template-overrides'
import { loadDbTemplates } from '@/lib/studio/db-templates'
import { DEFAULT_DEV_SPEC, sanitizeDevSpec, type DevSpec } from '@/lib/studio/dev-spec'

// 게임 설명 → 장르 인식 + 친숙한 조작안 2~3개 제안 (가벼운 Haiku 호출, 무료·텍스트만)
// 사용자가 카드로 조작을 고르면 그 조작으로 게임을 생성한다.

export type PlanControl = { id: string; label: string; desc: string; keys: string; variantSlug?: string }
export type PlanResult = { genre: string; options: PlanControl[] }

const SYS = `너는 게임 조작 설계 도우미다. 사용자가 만들려는 게임 설명을 읽고, 그 장르를 파악한 뒤 사람들이 익숙해할 조작 방식 2~3개를 제안한다.
반드시 아래 JSON 형식만 출력한다(설명·코드펜스 금지):
{"genre":"장르 한국어","options":[{"id":"a","label":"짧은 이름","desc":"한 줄 설명","keys":"실제 키 요약"}]}
규칙:
- 표준 행동 어휘만 사용: 좌우 이동, 상하 이동, 점프, 앉기, 발사/액션. 새 조작을 지어내지 않는다.
- 장르에 가장 흔한 조작을 첫 번째(추천)로. 예: 러너=점프 한 손, 슈팅=이동+발사, 벽돌깨기=좌우, 테트리스=좌우+회전+낙하, 플랫포머=좌우+점프, 탑다운=4방향+액션, 리듬=원터치, 레이싱=조향+가속.
- label 은 5~10자 한국어. keys 는 "스페이스/탭 = 점프" 처럼 아주 짧게.
- options 는 2개 또는 3개. 마지막에 억지 옵션을 넣지 말 것.`

// AI 실패 시 안전한 기본안 (설명 없이도 진행 가능)
const FALLBACK: PlanResult = {
  genre: '액션',
  options: [
    { id: 'a', label: '기본 조작', desc: '방향키로 움직이고 스페이스로 액션', keys: '←→(↑↓) 이동 · 스페이스 액션' },
    { id: 'b', label: '한 손 점프', desc: '스페이스/탭 한 번으로 점프', keys: '스페이스/탭 = 점프' },
  ],
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let prompt = '', mode = ''
  try { const b = await req.json(); prompt = String(b?.prompt ?? '').slice(0, 2000); mode = String(b?.mode ?? '') } catch { /* ignore */ }
  if (mode === 'dev') return Response.json(await devPlan(prompt, !!user))   // 로그인 안 했으면 AI 없이 키워드로만 추정
  if (!user) return Response.json(FALLBACK)
  if (!prompt.trim() || !process.env.ANTHROPIC_API_KEY) return Response.json(FALLBACK)

  // 기존 템플릿에 매칭되면:
  //  · 조작 변형이 여러 개인 장르(genreGroup)면 → 그 변형들을 조작 카드로 제시 (메타데이터 기반, Haiku 토큰 0)
  //  · 변형이 하나뿐이면(테트리스 등 조작 고정) → skip, 바로 생성
  try {
    const staticList = await effectiveStaticTemplates()
    const dbList = await loadDbTemplates()
    const matched = matchTemplateIn(staticList, prompt) ?? matchTemplateIn(dbList, prompt)
    if (matched) {
      const grp = matched.template.genreGroup
      const variants = grp ? [...staticList, ...dbList].filter(t => t.genreGroup === grp) : []
      if (variants.length >= 2) {
        const options: PlanControl[] = variants.map(t => ({ id: t.slug, label: t.controlLabel ?? t.name, desc: t.controls?.desc ?? '', keys: t.controls?.keys ?? '', variantSlug: t.slug }))
        return Response.json({ genre: matched.template.name, options })
      }
      return Response.json({ skip: true })
    }
  } catch { /* 템플릿 확인 실패 시엔 그냥 아래 제안 단계로 */ }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYS,
      messages: [{ role: 'user', content: `게임 설명: ${prompt}` }],
    })
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
    const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as PlanResult
    const options = (parsed.options ?? [])
      .filter(o => o && o.label && o.keys)
      .slice(0, 3)
      .map((o, i) => ({ id: o.id || String.fromCharCode(97 + i), label: String(o.label).slice(0, 24), desc: String(o.desc ?? '').slice(0, 80), keys: String(o.keys).slice(0, 60) }))
    if (options.length < 2) return Response.json(FALLBACK)
    return Response.json({ genre: String(parsed.genre ?? '게임').slice(0, 20), options })
  } catch {
    return Response.json(FALLBACK)
  }
}

// ── 개발 AI 모드: 프롬프트를 읽고 상세 설정을 먼저 채운다 (Haiku 1회, 실패해도 기본값으로 진행) ──
const DEV_SYS = `너는 게임 기획 도우미다. 사용자가 만들려는 게임 설명을 읽고, 개발 설정의 가장 알맞은 값을 고르고 조작안 2~3개를 제안한다.
반드시 아래 JSON 만 출력한다(설명·코드펜스 금지):
{"genre":"장르 한국어","spec":{"dimension":"2d|3d","art":"auto|pixel|cartoon|neon|realistic|minimal","online":"offline|coop|versus","story":true|false,"device":"both|pc|mobile","difficulty":"easy|normal|hard","goal":"이기는 조건 한 줄(설명에 없으면 장르에 맞게 제안)"},"options":[{"id":"a","label":"짧은 이름","desc":"한 줄 설명","keys":"실제 키 요약"}]}
규칙:
- 설명에 3D·입체·1인칭·비행·레이싱 3D 같은 말이 있으면 3d, 아니면 2d.
- 함께·친구·2인·대결·협동 같은 말이 없으면 offline. 스토리·세계관·주인공 이야기가 있으면 story=true.
- art 는 설명에 화풍이 드러날 때만 고르고 아니면 auto. device 는 대부분 both. difficulty 는 기본 normal.
- 조작안은 표준 행동 어휘(좌우·상하 이동, 점프, 앉기, 발사/액션)만, 장르에 가장 흔한 것을 첫 번째로. label 5~10자, keys 는 "스페이스/탭 = 점프" 처럼 짧게.`

async function devPlan(prompt: string, useAi = true): Promise<{ genre: string; spec: DevSpec; options: PlanControl[] }> {
  const guess: DevSpec = { ...DEFAULT_DEV_SPEC, dimension: /3d|입체|1인칭|3인칭/i.test(prompt) ? '3d' : '2d', online: /대결|대전|pvp|vs/i.test(prompt) ? 'versus' : /협동|같이|함께|2인/.test(prompt) ? 'coop' : 'offline', story: /스토리|이야기|세계관|주인공/.test(prompt) }
  const fallback = { genre: '게임', spec: guess, options: FALLBACK.options }
  if (!useAi || !prompt.trim() || !process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 600, system: DEV_SYS, messages: [{ role: 'user', content: `게임 설명: ${prompt}` }] })
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
    const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as { genre?: string; spec?: unknown; options?: PlanControl[] }
    const options = (parsed.options ?? []).filter(o => o && o.label && o.keys).slice(0, 3)
      .map((o, i) => ({ id: o.id || String.fromCharCode(97 + i), label: String(o.label).slice(0, 24), desc: String(o.desc ?? '').slice(0, 80), keys: String(o.keys).slice(0, 60) }))
    return { genre: String(parsed.genre ?? '게임').slice(0, 20), spec: sanitizeDevSpec(parsed.spec) ?? guess, options: options.length >= 2 ? options : FALLBACK.options }
  } catch { return fallback }
}
