// TokenPilot 공개 API — 작업·토큰 예상치를 주면 "품질 하한을 만족하는 최저가 모델"과 원가·권장 판매가를 돌려준다.
// 인증: Authorization: Bearer <key> (env TOKENPILOT_API_KEYS, 쉼표 구분) 또는 관리자 세션.
//   POST { task, quality?, input_tokens?, output_tokens?, prompt_chars?, html_chars? }
import { createClient } from '@/lib/supabase/server'
import { route, type RouteInput, type Task, MODEL_CATALOG } from '@/lib/llm/router'
import { loadPolicy } from '@/lib/tokenpilot/policy'
import { MODEL_PRICES, KRW_PER_USD } from '@/lib/llm/pricing'

const TASKS: Task[] = ['create', 'edit', 'template_edit', 'explain', 'from_image', 'bj_chat', 'aj_report', 'chat', 'classify']

async function authorized(req: Request) {
  const keys = (process.env.TOKENPILOT_API_KEYS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && keys.includes(auth.slice(7).trim())) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return (p as { role?: string } | null)?.role === 'admin'
}

export async function GET() {
  return Response.json({
    name: 'TokenPilot', version: '1.0', description: 'LLM 최저가 라우팅·원가 측정 엔진',
    tasks: TASKS, models: Object.entries(MODEL_CATALOG).map(([id, m]) => ({ id, label: MODEL_PRICES[id]?.label, tier: m.tier, price_per_1m: MODEL_PRICES[id], strengths: m.strengths })),
    krw_per_usd: KRW_PER_USD,
    usage: 'POST /api/tokenpilot/estimate  Authorization: Bearer <key>  { "task": "create", "output_tokens": 12000, "quality": "balanced" }',
  })
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b || !TASKS.includes(b.task as Task)) return Response.json({ error: `task must be one of ${TASKS.join(', ')}` }, { status: 400 })
  const input: RouteInput = {
    task: b.task as Task,
    quality: (['best', 'balanced', 'cheap'] as const).includes(b.quality as 'best') ? (b.quality as 'best') : undefined,
    inputTokens: Number(b.input_tokens) || undefined, outputTokens: Number(b.output_tokens) || undefined,
    promptChars: Number(b.prompt_chars) || undefined, htmlChars: Number(b.html_chars) || undefined,
  }
  const policy = await loadPolicy()
  const r = route(input, policy)
  return Response.json({ engine: 'TokenPilot', input, recommended: r.model, rationale: r.rationale, estimate: r.estimate, candidates: r.candidates, policy: { targetMargin: policy.targetMargin, krwPerCredit: policy.krwPerCredit } })
}
