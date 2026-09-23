// app/api/studio/explain/route.ts
// 학습 노트 — 이 게임의 코드가 어떻게 짜였는지(코드 보기) / 프롬프트에서 어떤 시나리오가 나왔는지(시나리오 보기)를
// 아이도 이해할 수 있게 설명. 버전별로 한 번만 생성해 studio_versions.notes 에 캐시(컬럼 없으면 매번 생성).
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/llm/usage'

export const runtime = 'nodejs'
export const maxDuration = 60

export interface StudyNotes {
  code: { title: string; body: string; snippet?: string }[]      // 코드 구조 설명 (단계별)
  scenario: { title: string; body: string }[]                     // 프롬프트 → 시나리오 (목표/규칙/조작/난이도/캐릭터)
  glossary: { term: string; meaning: string }[]                   // 어린이용 용어 사전
  challenge: string[]                                             // 다음에 해볼 것 (프롬프트 예시)
  prompt: { improved: string; tips: string[] }                    // 다음에 똑같이/더 정확히 만들려면 — 정리된 완성 프롬프트 + 작성 요령
}

const NOTES_VERSION = 2 // 설명 톤/스키마가 바뀌면 올린다 → 옛 캐시는 다시 생성

const SYSTEM = `너는 초등학생(3~4학년)에게 게임 만들기를 가르치는 친절한 선생님이야. 주어진 HTML5 게임 코드와, 그 게임을 만들 때 사용자가 쓴 프롬프트를 보고 학습 노트를 JSON 으로 만든다.
반드시 JSON 만 출력. 스키마:
{
  "code": [ { "title": "…", "body": "…", "snippet": "핵심 코드 4~8줄(선택)" } ],   // 5~6개: 실제 코드 순서대로 — 화면(도화지) 준비, 그리기, 조작(키/터치), 규칙·점수, 부딪힘 판정, 게임오버·다시하기, 폰/PC 맞추기
  "scenario": [ { "title": "…", "body": "…" } ],   // 5~6개: 내가 쓴 말이 게임의 어떤 부분이 됐는지 — 목표, 규칙, 조작 방법, 어려워지는 방식, 캐릭터·배경(왜 이렇게 정했는지)
  "glossary": [ { "term": "…", "meaning": "…" } ], // 6~8개: 이 코드에 나오는 것 위주 (캔버스, 변수, 함수, 조건문, 반복, 이벤트, 충돌 판정 등)
  "challenge": [ "…" ],                            // 3~4개: 아이가 다음에 시도해볼 수정 프롬프트 (예: "적을 두 배로 늘려줘")
  "prompt": {
    "improved": "…",   // 이 게임을 다음에 한 번에 똑같이(또는 더 정확히) 만들 수 있는 완성 프롬프트 1개(4~8문장): 장르·목표·조작·규칙·점수·난이도·화면 스타일·모바일 조작을 빠짐없이. 어린이가 따라 쓸 수 있는 쉬운 말로
    "tips": [ "…" ]    // 4~5개: 프롬프트 잘 쓰는 법 — 사용자가 실제로 쓴 프롬프트에서 빠졌던 것/애매했던 것을 짚어주고 어떻게 쓰면 좋은지 (예: "조작키를 정확히 적어요: '←→로 이동, 스페이스로 점프'")
  }
}
글쓰기 규칙(중요):
- 초등학생이 읽는다. 한 문장은 짧게(15자 안팎~25자), 한 항목 body 는 2~3문장.
- 어려운 낱말·영어·변수명(START_X 같은 것)·숫자 범위(120~380 등)를 시나리오/프롬프트에는 쓰지 않는다. 대신 "시작선", "점점 빨라져요" 처럼 말한다. 코드 설명에서만 꼭 필요할 때 낱말을 소개하고 바로 비유로 풀어 준다(예: "변수는 숫자를 담아 두는 상자예요").
- 비유를 적극 사용: 캔버스=도화지, 함수=레시피, 조건문=만약~라면, 반복=매 순간 다시 그리기, 충돌 판정=서로 닿았는지 확인.
- 말투는 "~해요/~예요". 어린이에게 말 걸듯. 이모지는 제목 앞에 하나만.
- snippet 은 코드에서 실제로 발췌하되 짧게(4~8줄).`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { versionId?: string } | null
  const versionId = body?.versionId
  if (!versionId) return Response.json({ error: 'bad request' }, { status: 400 })

  // RLS: 내 프로젝트의 버전만 읽힌다
  const { data: v } = await supabase.from('studio_versions').select('id, project_id, html, notes').eq('id', versionId).maybeSingle()
  const ver = v as { id: string; project_id: string; html: string; notes?: StudyNotes | null } | null
  if (!ver) return Response.json({ error: 'not found' }, { status: 404 })
  const cached = ver.notes as (StudyNotes & { v?: number }) | null | undefined
  if (cached && Array.isArray(cached.code) && cached.prompt?.improved && cached.v === NOTES_VERSION) return Response.json({ notes: cached, cached: true })

  // 이 버전을 만든 프롬프트 — 마지막 user 메시지들 (최근 3개)
  const { data: msgs } = await supabase.from('studio_messages').select('role, content').eq('project_id', ver.project_id).order('created_at', { ascending: false }).limit(6)
  const prompts = ((msgs ?? []) as { role: string; content: string }[]).filter((m) => m.role === 'user').slice(0, 3).reverse().map((m) => m.content)

  const html = ver.html.length > 60_000 ? ver.html.slice(0, 60_000) + '\n<!-- …(생략) -->' : ver.html
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `사용자 프롬프트(시간순):\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n') || '(없음)'}\n\n게임 HTML:\n${html}` }],
  })
  await logUsage({ userId: user.id, projectId: ver.project_id, versionId, kind: 'explain', model: 'claude-haiku-4-5-20251001', inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 })
  const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return Response.json({ error: 'no notes' }, { status: 502 })
  let notes: StudyNotes
  try { notes = JSON.parse(m[0]) } catch { return Response.json({ error: 'bad notes' }, { status: 502 }) }
  const clean: StudyNotes & { v: number } = {
    v: NOTES_VERSION,
    code: Array.isArray(notes.code) ? notes.code.slice(0, 8) : [],
    scenario: Array.isArray(notes.scenario) ? notes.scenario.slice(0, 8) : [],
    glossary: Array.isArray(notes.glossary) ? notes.glossary.slice(0, 10) : [],
    challenge: Array.isArray(notes.challenge) ? notes.challenge.slice(0, 5) : [],
    prompt: {
      improved: typeof notes.prompt?.improved === 'string' ? notes.prompt.improved : '',
      tips: Array.isArray(notes.prompt?.tips) ? notes.prompt.tips.slice(0, 6) : [],
    },
  }
  // 캐시 저장 — studio_versions 엔 update 정책이 없어 사용자 세션으론 0행 갱신됨 → 소유권은 위 select(RLS)로 확인했으니 admin 으로 기록
  const { error: cacheErr } = await createAdminClient().from('studio_versions').update({ notes: clean } as never).eq('id', versionId)
  if (cacheErr) console.error('[studio/explain] cache save failed', cacheErr)
  return Response.json({ notes: clean, cached: false })
}
