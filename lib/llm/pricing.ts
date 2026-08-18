// lib/llm/pricing.ts — 모델 단가(정가, USD / 1M tokens)와 원가 계산. 관리자 원가 대시보드·사용량 기록에서 공용.
export const KRW_PER_USD = 1380

export interface ModelPrice { input: number; output: number; label: string }
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5': { input: 3, output: 15, label: 'Claude Sonnet 5' },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, label: 'Claude Haiku 4.5' },
  'claude-haiku-4-5': { input: 1, output: 5, label: 'Claude Haiku 4.5' },
  'claude-opus-5': { input: 5, output: 25, label: 'Claude Opus 5' },
  none: { input: 0, output: 0, label: '없음(템플릿)' },
}
// 인트로 요금(2026-08-31까지) — 참고 표시용
export const SONNET5_INTRO = { input: 2, output: 10, until: '2026-08-31' }

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES['claude-sonnet-5']
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}
export const usdToKrw = (usd: number) => Math.round(usd * KRW_PER_USD)

/** 출력 토큰 상한 — 최악 케이스(64k) 방어. 무거운 게임(러너 21k)도 여유 있게 들어온다 */
export const GENERATION_MAX_TOKENS = 32000
