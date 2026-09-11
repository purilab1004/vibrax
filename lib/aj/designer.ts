// lib/aj/designer.ts — AJ 자율 게임 디자이너 루프 (서버 전용, service role)
// 리포트 제안 → 수정 프롬프트 → 새 버전(origin=auto) → 검증 게이트 → 카나리 20% → 지표 비교 → 채택/복귀.
// 사람은 스위치(automation aj.autoDesign + games.auto_design)·예산·거부권만 가진다. 설계: docs/plan 16장.
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { SYSTEM_PROMPT, buildMessages } from '@/lib/studio/prompt'
import { parseGeneration } from '@/lib/studio/parse'
import { hardenHtml } from '@/lib/studio/harden'
import { GENERATION_MAX_TOKENS, costUsd } from '@/lib/llm/pricing'
import { logUsage } from '@/lib/llm/usage'
import { route as routeModel } from '@/lib/llm/router'
import { loadPolicy } from '@/lib/tokenpilot/policy'
import { guardStatus } from '@/lib/tokenpilot/guard'
import { isAuto, logAutomation } from '@/lib/automation'
import { logServerError } from '@/lib/log/server'
import { buildAjReport, type AjReport, type ReportGame } from '@/lib/aj/report'
import { DEFAULT_DESIGN, summarize, decide, contractGate, type DesignSettings, type SessionRow, type VersionMetrics } from '@/lib/aj/design-score'

export type ExperimentStatus = 'proposed' | 'generating' | 'canary' | 'adopted' | 'reverted' | 'failed' | 'vetoed' | 'inconclusive'
export interface Hypothesis { title: string; why: string; prompt: string; impact: 'high' | 'medium' | 'low' }
export interface Experiment {
  id: string; game_id: string; project_id: string; base_version_id: string | null; candidate_version_id: string | null
  hypothesis: Hypothesis; status: ExperimentStatus; metrics_a: VersionMetrics | null; metrics_b: VersionMetrics | null
  score: number | null; cost_usd: number; note: string | null; started_at: string | null; decided_at: string | null; created_at: string
}
interface GameRow { id: string; title: string; description: string | null; genre: string; user_id: string; studio_project_id: string | null; coin_cost: number | null; teaser: string | null; live_version_id: string | null; canary_version_id: string | null; canary_ratio: number | null; auto_design: boolean | null }

export type CycleResult =
  | { kind: 'skipped'; reason: string }
  | { kind: 'evaluated'; experiment: Experiment; verdict: string; reason: string }
  | { kind: 'started'; experiment: Experiment }
  | { kind: 'failed'; experiment: Experiment | null; reason: string }

// ── 설정 (site_settings.aj_design) ──
let cache: { at: number; v: DesignSettings } | null = null
export async function loadDesignSettings(): Promise<DesignSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try {
    const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'aj_design').maybeSingle()
    const v = { ...DEFAULT_DESIGN, ...(((data as { value?: Partial<DesignSettings> } | null)?.value) ?? {}) }
    cache = { at: Date.now(), v }; return v
  } catch { return DEFAULT_DESIGN }
}
export async function saveDesignSettings(p: Partial<DesignSettings>) {
  const v = { ...(await loadDesignSettings()), ...p }
  await createAdminClient().from('site_settings').upsert({ key: 'aj_design', value: v, updated_at: new Date().toISOString() } as never)
  cache = null; return v
}

const GAME_COLS = 'id,title,description,genre,user_id,studio_project_id,coin_cost,teaser,live_version_id,canary_version_id,canary_ratio,auto_design'

/** 마이그레이션 미적용 환경 감지 — games.live_version_id 가 없으면 루프 전체를 건너뛴다 */
export async function designReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from('aj_experiments').select('id').limit(1)
  return !error
}

// ── 한 게임의 사이클: 진행 중 실험이 있으면 평가, 없으면 새 실험 시도 ──
export async function runDesignCycle(gameId: string, opts: { force?: boolean; actor?: string | null } = {}): Promise<CycleResult> {
  const admin = createAdminClient()
  if (!(await designReady(admin))) return { kind: 'skipped', reason: 'migration_missing' }
  const s = await loadDesignSettings()
  const { data: gRow } = await admin.from('games').select(GAME_COLS).eq('id', gameId).maybeSingle()
  const g = gRow as GameRow | null
  if (!g) return { kind: 'skipped', reason: 'not_found' }
  if (!g.studio_project_id) return { kind: 'skipped', reason: 'external_game' }

  // 1) 진행 중 실험 평가
  const { data: running } = await admin.from('aj_experiments').select('*').eq('game_id', gameId).eq('status', 'canary').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (running) return evaluateExperiment(admin, running as Experiment, g, s)

  // 2) 새 실험 자격
  if (!opts.force) {
    if (!g.auto_design) return { kind: 'skipped', reason: 'opt_out' }
    if (!(await isAuto('aj.autoDesign'))) return { kind: 'skipped', reason: 'automation_off' }
    const since = new Date(Date.now() - 86400_000).toISOString()
    const { count: today } = await admin.from('aj_experiments').select('id', { count: 'exact', head: true }).eq('game_id', gameId).gte('created_at', since)
    if ((today ?? 0) > 0) return { kind: 'skipped', reason: 'already_today' }
    const { count: traffic } = await admin.from('game_sessions').select('id', { count: 'exact', head: true }).eq('game_id', gameId).gte('started_at', new Date(Date.now() - 30 * 86400_000).toISOString())
    if ((traffic ?? 0) < s.minTrafficSessions) return { kind: 'skipped', reason: `low_traffic:${traffic ?? 0}` }
  }
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { count: adopted } = await admin.from('aj_experiments').select('id', { count: 'exact', head: true }).eq('game_id', gameId).eq('status', 'adopted').gte('decided_at', monthAgo)
  if ((adopted ?? 0) >= s.perGameMonthly) return { kind: 'skipped', reason: 'monthly_cap' }
  // 예산·원가 가드 (force 여도 적용 — 돈은 하드 리밋)
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const { data: spent } = await admin.from('llm_usage').select('cost_usd').eq('kind', 'auto_edit').gte('created_at', dayStart.toISOString()).limit(2000)
  const spentUsd = ((spent ?? []) as { cost_usd: number }[]).reduce((a, r) => a + Number(r.cost_usd || 0), 0)
  if (spentUsd >= s.dailyBudgetUsd) return { kind: 'skipped', reason: `daily_budget:${spentUsd.toFixed(2)}` }
  try { const { stats } = await guardStatus(); if (stats.blocked) return { kind: 'skipped', reason: `cost_guard:${stats.reason ?? ''}` } } catch { /* 가드 조회 실패는 무시 */ }

  // 3) 진단 — 7일 이내 리포트가 있으면 재사용, 없으면 생성
  const { data: repRow } = await admin.from('aj_reports').select('report,created_at').eq('game_id', gameId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const repPrev = repRow as { report: AjReport; created_at: string } | null
  let rep: AjReport | null = repPrev && Date.now() - new Date(repPrev.created_at).getTime() < 7 * 86400_000 ? repPrev.report : null
  // 라이브 버전 HTML
  const live = await loadLiveVersion(admin, g)
  if (!live) return { kind: 'skipped', reason: 'no_version' }
  if (!rep) {
    try { rep = (await buildAjReport(admin, g as ReportGame, opts.actor ?? null, { html: live.html })).report } catch (e) { void logServerError('api', e, { path: 'aj/designer:report' }); return { kind: 'skipped', reason: 'report_failed' } }
  }

  // 4) 가설 선택 — impact 순, 이전에 실패·복귀·거부·채택된 가설 제목은 제외
  const { data: prev } = await admin.from('aj_experiments').select('hypothesis,status').eq('game_id', gameId).limit(50)
  const used = new Set(((prev ?? []) as { hypothesis: Hypothesis; status: string }[]).map(p => norm(p.hypothesis?.title)))
  const order = { high: 0, medium: 1, low: 2 }
  const cands = (rep.suggestions ?? []).filter(x => x && typeof x.prompt === 'string' && x.prompt.trim()).sort((a, b) => (order[a.impact] ?? 3) - (order[b.impact] ?? 3))
  const hyp = cands.find(x => !used.has(norm(x.title))) ?? null
  if (!hyp) return { kind: 'skipped', reason: 'no_new_hypothesis' }

  // 5) 실험 행 생성
  const { data: expIns } = await admin.from('aj_experiments').insert([{ game_id: gameId, project_id: g.studio_project_id, base_version_id: live.id, hypothesis: hyp, status: 'generating', note: opts.force ? `manual:${opts.actor ?? ''}` : null }] as never).select('*').maybeSingle()
  const exp = expIns as Experiment | null
  if (!exp) return { kind: 'failed', experiment: null, reason: 'insert_failed' }

  // 6) 생성 — 튜닝 범위를 강제하는 접두 + 계약 유지
  const prompt = `[AJ 자동 튜닝] 이 게임의 장르·규칙·목표·조작 방식(VIBREX_GAME.inputs 의 채널 이름과 개수)은 그대로 유지한다. 새로운 조작을 추가하거나 기존 조작을 없애지 마라. 아래 한 가지만 조정한 전체 완성본을 출력한다.\n조정: ${hyp.prompt}\n이유: ${hyp.why}`
  let html: string | null = null, description = ''
  let usedIn = 0, usedOut = 0, model = 'claude-sonnet-5'
  try {
    const routed = routeModel({ task: 'edit', promptChars: prompt.length, htmlChars: live.html.length }, await loadPolicy())
    model = routed.model
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await client.messages.stream({ model, max_tokens: GENERATION_MAX_TOKENS, ...(model.startsWith('claude-sonnet-5') || model.startsWith('claude-opus-5') ? { thinking: { type: 'adaptive' as const }, output_config: { effort: 'medium' as const } } : {}), system: SYSTEM_PROMPT, messages: buildMessages({ prompt, currentHtml: live.html, history: [] }) as never }).finalMessage()
    usedIn = res.usage?.input_tokens ?? 0; usedOut = res.usage?.output_tokens ?? 0
    const text = res.content.map(c => (c.type === 'text' ? c.text : '')).join('')
    const parsed = parseGeneration(text)
    html = parsed.html; description = parsed.description
    if (text.includes('<offtopic')) html = null
  } catch (e) {
    void logServerError('api', e, { path: 'aj/designer:generate' })
  }
  const cost = costUsd(model, usedIn, usedOut)
  await logUsage({ userId: g.user_id, projectId: g.studio_project_id, kind: 'auto_edit', model, inputTokens: usedIn, outputTokens: usedOut, credits: 0, meta: { experimentId: exp.id, gameId } })
  const fail = async (reason: string) => {
    await admin.from('aj_experiments').update({ status: 'failed', note: reason, cost_usd: cost, decided_at: new Date().toISOString() } as never).eq('id', exp.id)
    void logAutomation({ module: 'aj', action: '자율 튜닝 실패', target: gameId, status: 'error', detail: { experimentId: exp.id, reason, hypothesis: hyp.title } })
    return { kind: 'failed' as const, experiment: { ...exp, status: 'failed' as const, note: reason }, reason }
  }
  if (!html) return fail('생성 실패 또는 게임 아님')

  // 7) 검증 게이트 — 구조·계약·안전
  const gate = contractGate(live.html, html, live.html.length)
  if (!gate.ok) return fail(`계약 게이트: ${gate.reason}`)
  const hardened = hardenHtml(html)
  const { data: maxV } = await admin.from('studio_versions').select('version').eq('project_id', g.studio_project_id).order('version', { ascending: false }).limit(1).maybeSingle()
  const nextVersion = ((maxV as { version: number } | null)?.version ?? 0) + 1
  const { data: vIns, error: vErr } = await admin.from('studio_versions').insert([{ project_id: g.studio_project_id, version: nextVersion, html: hardened, origin: 'auto', experiment_id: exp.id }] as never).select('id').maybeSingle()
  if (vErr || !vIns) return fail(`버전 저장 실패: ${vErr?.message ?? ''}`)
  const candId = (vIns as { id: string }).id

  // 8) 카나리 시작
  const now = new Date().toISOString()
  await Promise.all([
    admin.from('games').update({ live_version_id: live.id, canary_version_id: candId } as never).eq('id', gameId),
    admin.from('aj_experiments').update({ status: 'canary', candidate_version_id: candId, started_at: now, cost_usd: cost, note: description.slice(0, 300) || null } as never).eq('id', exp.id),
    admin.from('aj_learn_log').insert([{ game_id: gameId, user_id: g.user_id, kind: 'design', title: `AJ 튜닝 실험 시작 — ${hyp.title}`, detail: `v${nextVersion} 을 플레이어 ${Math.round((g.canary_ratio ?? s.canaryRatio) * 100)}% 에게 먼저 보여주고 지표를 비교해요. ${hyp.why}`, version: nextVersion }] as never),
  ])
  void logAutomation({ module: 'aj', action: '자율 튜닝 카나리 시작', target: gameId, detail: { experimentId: exp.id, hypothesis: hyp.title, version: nextVersion, costUsd: cost } })
  const { data: fresh } = await admin.from('aj_experiments').select('*').eq('id', exp.id).maybeSingle()
  return { kind: 'started', experiment: fresh as Experiment }
}

// ── 진행 중 실험 평가 ──
export async function evaluateExperiment(admin: SupabaseClient, exp: Experiment, g: GameRow, s: DesignSettings): Promise<CycleResult> {
  if (!exp.started_at || !exp.candidate_version_id || !exp.base_version_id) return endCanary(admin, exp, g, 'failed', '실험 데이터 불완전', null, null, null)
  // 크리에이터가 실험 중 새 버전을 올렸으면 기준(base)이 낡았다 — 실험을 접고 새 버전을 존중
  const live = await loadLiveVersion(admin, g)
  if (live && live.id !== exp.base_version_id && live.id !== exp.candidate_version_id) return endCanary(admin, exp, g, 'inconclusive', `크리에이터가 새 버전(v${live.version})을 올려 실험을 종료했어요`, null, null, null)
  const { data: rows } = await admin.from('game_sessions').select('version_id,duration_sec,game_overs,cleared,autopilot,user_id')
    .eq('game_id', g.id).gte('started_at', exp.started_at).not('version_id', 'is', null).limit(5000)
  type R = SessionRow & { version_id: string }
  const all = ((rows ?? []) as R[]).filter(r => !r.autopilot && r.user_id !== g.user_id)   // 오토파일럿·제작자 본인 제외
  const a = summarize(all.filter(r => r.version_id === exp.base_version_id))
  const b = summarize(all.filter(r => r.version_id === exp.candidate_version_id))
  const days = (Date.now() - new Date(exp.started_at).getTime()) / 86400_000
  const d = decide(a, b, days, s)
  await admin.from('aj_experiments').update({ metrics_a: a, metrics_b: b, score: d.score } as never).eq('id', exp.id)
  if (d.verdict === 'continue') return { kind: 'evaluated', experiment: { ...exp, metrics_a: a, metrics_b: b, score: d.score }, verdict: 'continue', reason: d.reason }
  if (d.verdict === 'adopt') {
    const now = new Date().toISOString()
    await Promise.all([
      admin.from('games').update({ live_version_id: exp.candidate_version_id, canary_version_id: null } as never).eq('id', g.id),
      admin.from('aj_experiments').update({ status: 'adopted', decided_at: now, note: d.reason, metrics_a: a, metrics_b: b, score: d.score } as never).eq('id', exp.id),
      admin.from('aj_learn_log').insert([{ game_id: g.id, user_id: g.user_id, kind: 'design', title: `AJ 튜닝 채택 — ${exp.hypothesis?.title ?? ''}`, detail: `${d.reason}. 30초 이탈 ${pct(a.under30sRate)} → ${pct(b.under30sRate)}, 평균 체류 ${a.avgDurationSec}초 → ${b.avgDurationSec}초. 이 버전을 라이브로 바꿨어요.` }] as never),
    ])
    void logAutomation({ module: 'aj', action: '자율 튜닝 채택', target: g.id, detail: { experimentId: exp.id, score: d.score, deltas: d.deltas, a, b } })
    return { kind: 'evaluated', experiment: { ...exp, status: 'adopted', metrics_a: a, metrics_b: b, score: d.score }, verdict: 'adopt', reason: d.reason }
  }
  return endCanary(admin, exp, g, d.verdict === 'revert' ? 'reverted' : 'inconclusive', d.reason, a, b, d.score)
}

async function endCanary(admin: SupabaseClient, exp: Experiment, g: GameRow, status: ExperimentStatus, reason: string, a: VersionMetrics | null, b: VersionMetrics | null, score: number | null): Promise<CycleResult> {
  const now = new Date().toISOString()
  await Promise.all([
    admin.from('games').update({ canary_version_id: null } as never).eq('id', g.id),
    admin.from('aj_experiments').update({ status, decided_at: now, note: reason, metrics_a: a, metrics_b: b, score } as never).eq('id', exp.id),
    admin.from('aj_learn_log').insert([{ game_id: g.id, user_id: g.user_id, kind: 'design', title: `AJ 튜닝 ${status === 'reverted' ? '복귀' : status === 'vetoed' ? '중단' : status === 'inconclusive' ? '판정 보류' : '실패'} — ${exp.hypothesis?.title ?? ''}`, detail: reason }] as never),
  ])
  void logAutomation({ module: 'aj', action: `자율 튜닝 ${status}`, target: g.id, status: status === 'inconclusive' ? 'needs_review' : 'ok', detail: { experimentId: exp.id, reason, score, a, b } })
  return { kind: 'evaluated', experiment: { ...exp, status, metrics_a: a, metrics_b: b, score, note: reason }, verdict: status, reason }
}

/** 크리에이터 거부권 — 진행 중 카나리를 즉시 종료 */
export async function vetoExperiment(gameId: string, actor: string): Promise<CycleResult> {
  const admin = createAdminClient()
  const [{ data: gRow }, { data: exp }] = await Promise.all([
    admin.from('games').select(GAME_COLS).eq('id', gameId).maybeSingle(),
    admin.from('aj_experiments').select('*').eq('game_id', gameId).eq('status', 'canary').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!gRow || !exp) return { kind: 'skipped', reason: 'no_running' }
  return endCanary(admin, exp as Experiment, gRow as GameRow, 'vetoed', `크리에이터가 중단 (${actor})`, null, null, null)
}

/** 채택된 마지막 실험을 되돌린다 — live 를 base 버전으로 */
export async function rollbackLastAdopted(gameId: string, actor: string): Promise<CycleResult> {
  const admin = createAdminClient()
  const { data: exp } = await admin.from('aj_experiments').select('*').eq('game_id', gameId).eq('status', 'adopted').order('decided_at', { ascending: false }).limit(1).maybeSingle()
  const e = exp as Experiment | null
  if (!e || !e.base_version_id) return { kind: 'skipped', reason: 'no_adopted' }
  await Promise.all([
    admin.from('games').update({ live_version_id: e.base_version_id } as never).eq('id', gameId),
    admin.from('aj_experiments').update({ status: 'reverted', note: `채택 후 크리에이터가 되돌림 (${actor})`, decided_at: new Date().toISOString() } as never).eq('id', e.id),
  ])
  void logAutomation({ module: 'aj', action: '자율 튜닝 채택 되돌림', target: gameId, detail: { experimentId: e.id, actor } })
  return { kind: 'evaluated', experiment: { ...e, status: 'reverted' }, verdict: 'rolled_back', reason: '되돌림' }
}

/** 크론: 진행 중 실험 전부 평가 → opt-in 게임에서 최대 N개 새 실험 */
export async function runDesignSweep(opts: { maxNew?: number } = {}): Promise<{ evaluated: CycleResult[]; started: CycleResult[]; skipped: number }> {
  const admin = createAdminClient()
  if (!(await designReady(admin))) return { evaluated: [], started: [], skipped: 0 }
  const s = await loadDesignSettings()
  const evaluated: CycleResult[] = []
  const { data: running } = await admin.from('aj_experiments').select('*').eq('status', 'canary').limit(200)
  for (const e of (running ?? []) as Experiment[]) {
    const { data: gRow } = await admin.from('games').select(GAME_COLS).eq('id', e.game_id).maybeSingle()
    if (!gRow) continue
    try { evaluated.push(await evaluateExperiment(admin, e, gRow as GameRow, s)) } catch (err) { void logServerError('api', err, { path: 'aj/designer:evaluate' }) }
  }
  const started: CycleResult[] = []
  let skipped = 0
  const maxNew = opts.maxNew ?? 3
  if (await isAuto('aj.autoDesign')) {
    const { data: games } = await admin.from('games').select('id').eq('auto_design', true).not('studio_project_id', 'is', null).order('view_count', { ascending: false }).limit(100)
    for (const g of (games ?? []) as { id: string }[]) {
      if (started.length >= maxNew) break
      try {
        const r = await runDesignCycle(g.id)
        if (r.kind === 'started') started.push(r); else if (r.kind === 'failed') started.push(r); else skipped++
      } catch (err) { void logServerError('api', err, { path: 'aj/designer:cycle' }) }
    }
  }
  return { evaluated, started, skipped }
}

/** 라이브 = 지정 live_version 과 최신 사람 버전(origin≠auto) 중 더 새로운 것 (/play 와 같은 규칙) */
async function loadLiveVersion(admin: SupabaseClient, g: GameRow): Promise<{ id: string; html: string; version: number } | null> {
  type V = { id: string; html: string; version: number }
  const [{ data: latest }, liveRes] = await Promise.all([
    admin.from('studio_versions').select('id,html,version').eq('project_id', g.studio_project_id!).neq('origin', 'auto').order('version', { ascending: false }).limit(1).maybeSingle(),
    g.live_version_id ? admin.from('studio_versions').select('id,html,version').eq('id', g.live_version_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const l = latest as V | null, lv = (liveRes.data ?? null) as V | null
  return lv && (!l || lv.version >= l.version) ? lv : l
}

const norm = (s: string | undefined | null) => (s ?? '').toLowerCase().replace(/\s+/g, '')
const pct = (v: number) => `${Math.round(v * 100)}%`
