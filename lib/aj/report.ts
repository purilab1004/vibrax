// lib/aj/report.ts — AJ Brain 리포트 생성 (서버 전용). /api/aj/analyze 와 자율 디자이너 루프가 공용.
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { collectGameMetrics, type GameMetrics } from '@/lib/aj/metrics'
import { logUsage } from '@/lib/llm/usage'

export interface AjReport {
  fun_score: number                    // 0~100
  headline: string                     // 한 줄 총평
  funnel: { stage: string; value: string; note: string }[]   // 재미→체류→참여→전환→수익
  insights: { title: string; body: string; evidence: string }[]
  dropoff: { where: string; why: string }
  suggestions: { title: string; why: string; prompt: string; impact: 'high' | 'medium' | 'low' }[]  // 스튜디오에 바로 넣을 수정 프롬프트
  broadcast: { opening: string; hooks: string[]; shorts_script: string; thumbnail_title: string }
  monetization: { ideas: { title: string; body: string }[] }
  next_experiment: string
}

export interface ReportGame { id: string; title: string; description: string | null; genre: string; user_id: string; studio_project_id: string | null; coin_cost: number | null; teaser: string | null }

const SYSTEM = `너는 Vibrexcup 의 AJ — 게임 하나를 사업체처럼 운영하는 AI 게임 기업가(스트리머+성장+수익 담당)다.
게임의 코드, 제작 프롬프트, 실제 플레이 지표(세션 수·체류시간·초반 이탈률·점수·게임오버·코인 수익·조회·좋아요·공유)를 보고
"이 게임이 재미있고 돈을 벌고 있는가"를 판단하고, 다음 한 수를 제안한다. 반드시 JSON 만 출력. 스키마:
{
  "fun_score": 0~100,
  "headline": "한 줄 총평",
  "funnel": [ {"stage":"재미|체류|참여|전환|수익","value":"지표 값(예: 평균 3분 12초)","note":"짧은 해석"} ],  // 5단계
  "insights": [ {"title":"…","body":"2~3문장","evidence":"근거가 된 숫자/코드"} ],  // 3~5개
  "dropoff": {"where":"어느 구간(예: 시작 30초)","why":"원인 가설"},
  "suggestions": [ {"title":"…","why":"…","prompt":"스튜디오 채팅에 그대로 넣을 수정 프롬프트(구체적, 1~3문장)","impact":"high|medium|low"} ],  // 3~5개, 난이도/보상/초반 훅/모바일 조작/시각 피드백 위주. 장르·규칙·조작 방식을 바꾸는 제안은 금지 — 같은 게임의 '튜닝'만.
  "broadcast": {"opening":"AJ 방송 오프닝 멘트 2문장","hooks":["시청자 붙잡는 멘트 3개"],"shorts_script":"15초 쇼츠 대본(장면/자막)","thumbnail_title":"썸네일 문구 8자 이내"},
  "monetization": {"ideas":[{"title":"…","body":"…"}]},  // 2~4개: 코인 가격, 아이템, 후원 이벤트, 스폰서, 다른 게임 유도
  "next_experiment": "다음 방송/업데이트에서 검증할 가설 1개"
}
데이터가 적으면(세션 5개 미만) 그 사실을 headline 에 밝히고 코드/프롬프트 중심으로 판단하되, 지표는 '표본 부족'으로 표시한다. 한국어, 구체적 숫자 인용.`

/** 지표 수집 → Sonnet 리포트 → aj_reports 저장. 실패 시 throw. */
export async function buildAjReport(admin: SupabaseClient, g: ReportGame, createdBy: string | null, opts: { html?: string | null; days?: number } = {}): Promise<{ report: AjReport; metrics: GameMetrics; saved: { id: string; created_at: string } | null }> {
  const metrics = await collectGameMetrics(admin, g.id, opts.days ?? 30)
  let html = opts.html ?? ''
  let prompts: string[] = []
  if (g.studio_project_id) {
    const [{ data: v }, { data: msgs }] = await Promise.all([
      html ? Promise.resolve({ data: null }) : admin.from('studio_versions').select('html').eq('project_id', g.studio_project_id).order('version', { ascending: false }).limit(1).maybeSingle(),
      admin.from('studio_messages').select('role,content').eq('project_id', g.studio_project_id).order('created_at', { ascending: true }).limit(20),
    ])
    if (!html) html = (v as { html: string } | null)?.html ?? ''
    prompts = ((msgs ?? []) as { role: string; content: string }[]).filter((m) => m.role === 'user').map((m) => m.content).slice(-6)
  }
  const codeSnippet = html ? (html.length > 40_000 ? html.slice(0, 40_000) + '\n<!-- …(생략) -->' : html) : '(외부 게임 — 코드 없음)'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    thinking: { type: 'adaptive' }, output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `게임: ${g.title} (${g.genre}) · 코인 ${g.coin_cost ?? 1}/판\n설명: ${g.description ?? ''}\n훅 문구: ${g.teaser ?? ''}\n\n제작 프롬프트(시간순):\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n') || '(없음)'}\n\n최근 ${metrics.days}일 지표(JSON):\n${JSON.stringify(metrics)}\n\n게임 코드:\n${codeSnippet}` }],
  })
  await logUsage({ userId: createdBy, projectId: g.studio_project_id, kind: 'bj_chat', model: 'claude-sonnet-5', inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, meta: { aj_report: g.id } })
  const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no report')
  let report: AjReport
  try { report = JSON.parse(m[0]) } catch { throw new Error('bad report') }
  const { data: saved } = await admin.from('aj_reports').insert([{ game_id: g.id, created_by: createdBy, metrics, report }] as never).select('id,created_at').maybeSingle()
  return { report, metrics, saved: (saved as { id: string; created_at: string } | null) ?? null }
}
