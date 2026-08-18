// lib/llm/router.ts — TokenPilot: LLM 최저가 라우팅 엔진 코어.
// 작업(task)마다 "품질 하한을 만족하는 가장 싼 모델"을 고르고, 원가·판매가·마진을 한 번에 계산한다.
// vibrex 뿐 아니라 외부 서비스도 쓸 수 있게 순수 함수로만 구성 (DB/네트워크 없음).
import { MODEL_PRICES, costUsd, KRW_PER_USD } from '@/lib/llm/pricing'

export type Task = 'create' | 'edit' | 'template_edit' | 'explain' | 'from_image' | 'bj_chat' | 'aj_report' | 'chat' | 'classify'
export type Quality = 'best' | 'balanced' | 'cheap'

/** 모델 카탈로그 — 품질 등급(1~5)·용도. 단가는 pricing.ts 와 공유 */
export const MODEL_CATALOG: Record<string, { tier: number; strengths: string[]; contextK: number }> = {
  'claude-opus-5': { tier: 5, strengths: ['최고 난도 코드', '장문 추론'], contextK: 1000 },
  'claude-sonnet-5': { tier: 4, strengths: ['게임 코드 생성', '수정', '멀티모달'], contextK: 1000 },
  'claude-haiku-4-5-20251001': { tier: 3, strengths: ['설명', '분류', '짧은 채팅', '요약'], contextK: 200 },
}
export const CANDIDATE_MODELS = Object.keys(MODEL_CATALOG)

/** 작업별 최소 품질 등급 — 이 밑으로는 내려가지 않는다 */
export const MIN_TIER: Record<Task, number> = {
  create: 4, edit: 4, template_edit: 4, from_image: 4, aj_report: 4,
  explain: 3, bj_chat: 3, chat: 3, classify: 3,
}

export interface RouterPolicy {
  /** 작업 → 고정 모델 (없으면 자동 선택) */
  pins: Partial<Record<Task, string>>
  /** 자동 다운그레이드: 작은 수정(프롬프트·HTML 이 작을 때)은 Haiku 로 */
  autoDowngradeSmallEdits: boolean
  smallEditMaxHtmlChars: number
  /** 목표 마진 배수 (판매가 = 원가 × margin) */
  targetMargin: number
  /** 크레딧 1개의 목표 판매가 (KRW) — 팩 가격 역산용 */
  krwPerCredit: number
}
export const DEFAULT_POLICY: RouterPolicy = {
  pins: { create: 'claude-sonnet-5', edit: 'claude-sonnet-5', template_edit: 'claude-sonnet-5', explain: 'claude-haiku-4-5-20251001', bj_chat: 'claude-haiku-4-5-20251001', aj_report: 'claude-sonnet-5' },
  autoDowngradeSmallEdits: false,
  smallEditMaxHtmlChars: 12000,
  targetMargin: 3,
  krwPerCredit: 50,
}

export interface RouteInput { task: Task; quality?: Quality; inputTokens?: number; outputTokens?: number; promptChars?: number; htmlChars?: number }
export interface RouteCandidate { model: string; label: string; tier: number; costUsd: number; costKrw: number; eligible: boolean; reason?: string }
export interface RouteResult { model: string; candidates: RouteCandidate[]; rationale: string; estimate: { costUsd: number; costKrw: number; sellKrw: number; credits: number } }

/** 핵심: 품질 하한을 만족하는 후보 중 최저가 선택 (pin 이 있으면 pin 우선, 자동 다운그레이드 조건이면 Haiku) */
export function route(input: RouteInput, policy: RouterPolicy = DEFAULT_POLICY): RouteResult {
  const inTok = input.inputTokens ?? 6000, outTok = input.outputTokens ?? 8000
  const q = input.quality ?? 'balanced'
  const minTier = Math.max(1, MIN_TIER[input.task] + (q === 'best' ? 1 : q === 'cheap' ? -1 : 0))
  const candidates: RouteCandidate[] = CANDIDATE_MODELS.map(m => {
    const c = costUsd(m, inTok, outTok)
    const tier = MODEL_CATALOG[m].tier
    return { model: m, label: MODEL_PRICES[m]?.label ?? m, tier, costUsd: c, costKrw: Math.round(c * KRW_PER_USD), eligible: tier >= minTier, reason: tier < minTier ? `품질 등급 ${tier} < 요구 ${minTier}` : undefined }
  }).sort((a, b) => a.costUsd - b.costUsd)
  let model = candidates.find(c => c.eligible)?.model ?? 'claude-sonnet-5'
  let rationale = `품질 등급 ≥ ${minTier} 중 최저가`
  const pin = policy.pins[input.task]
  if (pin && MODEL_CATALOG[pin]) { model = pin; rationale = `정책 고정(${input.task} → ${MODEL_PRICES[pin]?.label})` }
  if ((input.task === 'edit' || input.task === 'template_edit') && policy.autoDowngradeSmallEdits && (input.htmlChars ?? Infinity) <= policy.smallEditMaxHtmlChars && (input.promptChars ?? 0) <= 200) {
    model = 'claude-haiku-4-5-20251001'; rationale = `작은 수정(HTML ≤ ${policy.smallEditMaxHtmlChars.toLocaleString()}자) → 자동 다운그레이드`
  }
  const cost = costUsd(model, inTok, outTok)
  const sellKrw = Math.round(cost * KRW_PER_USD * policy.targetMargin)
  return { model, candidates, rationale, estimate: { costUsd: cost, costKrw: Math.round(cost * KRW_PER_USD), sellKrw, credits: Math.max(1, Math.round(sellKrw / policy.krwPerCredit)) } }
}

/** 실측 로그로 절감액 계산 — "전부 Sonnet 으로 했다면" 대비 실제 원가 */
export function savingsOf(rows: { model: string; input_tokens: number; output_tokens: number; kind: string; cost_usd: number }[], avgCreateCostUsd: number) {
  let baseline = 0, actual = 0, templateSaved = 0, routingSaved = 0
  for (const r of rows) {
    actual += Number(r.cost_usd)
    if (r.model === 'none') { baseline += avgCreateCostUsd; templateSaved += avgCreateCostUsd; continue }
    const asSonnet = costUsd('claude-sonnet-5', r.input_tokens, r.output_tokens)
    baseline += asSonnet
    if (r.model !== 'claude-sonnet-5') routingSaved += Math.max(0, asSonnet - Number(r.cost_usd))
  }
  return { baseline, actual, saved: baseline - actual, templateSaved, routingSaved, ratio: baseline > 0 ? (baseline - actual) / baseline : 0 }
}
