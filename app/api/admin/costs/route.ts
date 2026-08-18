// app/api/admin/costs/route.ts — 관리자 원가 대시보드 데이터. llm_usage 집계 (최근 N일).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MODEL_PRICES, KRW_PER_USD, SONNET5_INTRO, GENERATION_MAX_TOKENS } from '@/lib/llm/pricing'
import { GENERATION_COST } from '@/lib/studio/constants'
import { savingsOf, DEFAULT_POLICY, type RouterPolicy } from '@/lib/llm/router'

export const runtime = 'nodejs'

interface Row { id: string; user_id: string | null; project_id: string | null; kind: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number; credits: number; template_slug: string | null; created_at: string }

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((prof as { role?: string } | null)?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days') ?? 30)))
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const admin = createAdminClient()
  const { data, error } = await admin.from('llm_usage').select('id,user_id,project_id,kind,model,input_tokens,output_tokens,cost_usd,credits,template_slug,created_at')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(5000)
  if (error) return Response.json({ error: error.message, hint: 'llm_usage 테이블이 없으면 db/migrations/2026-08-18-llm-usage.sql 을 실행하세요' }, { status: 500 })
  const rows = (data ?? []) as Row[]

  const sum = (arr: Row[], f: (r: Row) => number) => arr.reduce((a, r) => a + f(r), 0)
  const gen = rows.filter((r) => ['create', 'edit', 'template', 'template_edit'].includes(r.kind))
  const llmGen = gen.filter((r) => r.kind !== 'template')
  const byKind: Record<string, { calls: number; input: number; output: number; cost: number; credits: number }> = {}
  const byModel: Record<string, { calls: number; input: number; output: number; cost: number }> = {}
  const byDay: Record<string, { calls: number; cost: number; credits: number }> = {}
  const byUser: Record<string, { calls: number; cost: number; credits: number }> = {}
  const byProject: Record<string, { calls: number; cost: number; output: number }> = {}
  for (const r of rows) {
    const k = (byKind[r.kind] ??= { calls: 0, input: 0, output: 0, cost: 0, credits: 0 })
    k.calls++; k.input += r.input_tokens; k.output += r.output_tokens; k.cost += Number(r.cost_usd); k.credits += r.credits
    const m = (byModel[r.model] ??= { calls: 0, input: 0, output: 0, cost: 0 })
    m.calls++; m.input += r.input_tokens; m.output += r.output_tokens; m.cost += Number(r.cost_usd)
    const d = r.created_at.slice(0, 10)
    const dd = (byDay[d] ??= { calls: 0, cost: 0, credits: 0 }); dd.calls++; dd.cost += Number(r.cost_usd); dd.credits += r.credits
    if (r.user_id) { const u = (byUser[r.user_id] ??= { calls: 0, cost: 0, credits: 0 }); u.calls++; u.cost += Number(r.cost_usd); u.credits += r.credits }
    if (r.project_id && ['create', 'edit', 'template', 'template_edit'].includes(r.kind)) { const p = (byProject[r.project_id] ??= { calls: 0, cost: 0, output: 0 }); p.calls++; p.cost += Number(r.cost_usd); p.output += r.output_tokens }
  }
  const outs = llmGen.map((r) => r.output_tokens).sort((a, b) => a - b)
  const median = outs.length ? outs[Math.floor(outs.length / 2)] : 0
  const projects = Object.values(byProject)
  const perGameCost = projects.length ? sum(rows.filter((r) => r.project_id && byProject[r.project_id]), () => 0) || projects.reduce((a, p) => a + p.cost, 0) / projects.length : 0
  const totalCost = sum(rows, (r) => Number(r.cost_usd))
  const totalCredits = sum(rows, (r) => r.credits)
  const genCalls = gen.length
  const costPerCall = genCalls ? sum(gen, (r) => Number(r.cost_usd)) / genCalls : 0

  // 상위 사용자 프로필 이름
  const topUsers = Object.entries(byUser).sort((a, b) => b[1].cost - a[1].cost).slice(0, 10)
  const { data: profs } = await admin.from('profiles').select('id,username,agent_name').in('id', topUsers.map(([id]) => id))
  const nameOf = new Map(((profs ?? []) as { id: string; username: string | null; agent_name: string | null }[]).map((p) => [p.id, p.agent_name ?? p.username ?? p.id.slice(0, 8)]))

  // TokenPilot: 절감액(전부 Sonnet 대비) + 현재 라우팅 정책
  const createRows = llmGen.filter((r) => r.kind === 'create')
  const avgCreateCost = createRows.length ? sum(createRows, (r) => Number(r.cost_usd)) / createRows.length : 0.06
  const savings = savingsOf(rows, avgCreateCost)
  const { data: polRow } = await admin.from('site_settings').select('value').eq('key', 'tokenpilot_policy').maybeSingle()
  const policy: RouterPolicy = { ...DEFAULT_POLICY, ...(((polRow as { value?: Partial<RouterPolicy> } | null)?.value) ?? {}) }

  return Response.json({
    days, since, savings, policy,
    pricing: { models: MODEL_PRICES, krwPerUsd: KRW_PER_USD, intro: SONNET5_INTRO, generationCost: GENERATION_COST, maxTokens: GENERATION_MAX_TOKENS },
    totals: {
      calls: rows.length, genCalls, llmGenCalls: llmGen.length, templateLoads: byKind.template?.calls ?? 0,
      inputTokens: sum(rows, (r) => r.input_tokens), outputTokens: sum(rows, (r) => r.output_tokens),
      costUsd: totalCost, credits: totalCredits,
      avgOutputPerGen: llmGen.length ? sum(llmGen, (r) => r.output_tokens) / llmGen.length : 0,
      medianOutputPerGen: median,
      maxOutputPerGen: outs.length ? outs[outs.length - 1] : 0,
      costPerGenCall: costPerCall,
      projects: projects.length,
      avgCallsPerProject: projects.length ? gen.length / projects.length : 0,
      avgCostPerProject: perGameCost,
    },
    byKind, byModel,
    byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, ...v })),
    topUsers: topUsers.map(([id, v]) => ({ id, name: nameOf.get(id) ?? id.slice(0, 8), ...v })),
    heaviest: [...llmGen].sort((a, b) => b.output_tokens - a.output_tokens).slice(0, 10),
    recent: rows.slice(0, 50),
  })
}
