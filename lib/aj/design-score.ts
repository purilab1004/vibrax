// lib/aj/design-score.ts — 자율 게임 디자이너 루프의 판정 로직 (순수 함수, DB/네트워크 없음)
// 라이브(A) vs 카나리(B) 세션을 같은 기간에 비교해 채택/복귀/계속/판정불가를 결정한다.

export interface DesignSettings {
  canaryRatio: number      // 카나리 트래픽 비율 (0~1)
  minSessions: number      // 버전당 최소 세션 수
  maxDays: number          // 실험 최대 기간
  adoptAt: number          // 복합 점수 채택 임계 (상대 개선)
  revertAt: number         // 복합 점수 복귀 임계 (상대 악화)
  worstAllowed: number     // 어떤 지표도 이보다 나빠지면 채택 불가 (음수)
  earlyDropoutX: number    // 조기 복귀: 카나리 이탈률이 라이브의 X배를 넘으면
  earlyMinSessions: number // 조기 복귀 판단에 필요한 카나리 세션 수
  dailyBudgetUsd: number   // 플랫폼 일 예산
  perGameMonthly: number   // 게임당 월 채택 상한
  minTrafficSessions: number // 실험을 시작하려면 최근 30일 세션이 이 이상
}

export const DEFAULT_DESIGN: DesignSettings = {
  canaryRatio: 0.2, minSessions: 30, maxDays: 7, adoptAt: 0.08, revertAt: -0.05, worstAllowed: -0.10,
  earlyDropoutX: 1.5, earlyMinSessions: 10, dailyBudgetUsd: 5, perGameMonthly: 4, minTrafficSessions: 30,
}

export interface SessionRow { duration_sec: number; game_overs: number; cleared: boolean; autopilot?: boolean; user_id?: string | null }

export interface VersionMetrics {
  sessions: number
  under30sRate: number        // 낮을수록 좋음
  avgDurationSec: number      // 높을수록 좋음 (상위 1% 절단)
  restartRate: number | null  // 게임오버 2회 이상 비율 — 텔레메트리 없는 게임은 null
  clearRate: number | null    // 클리어 비율 — 클리어가 한 번도 없으면 null (클리어 조건 없는 게임)
}

const WEIGHTS = { dropout: 0.35, duration: 0.25, restart: 0.20, clear: 0.20 }

export function summarize(rows: SessionRow[]): VersionMetrics {
  const r = rows.filter(x => Number.isFinite(x.duration_sec) && x.duration_sec >= 0)
  const n = r.length
  if (!n) return { sessions: 0, under30sRate: 0, avgDurationSec: 0, restartRate: null, clearRate: null }
  const durs = r.map(x => x.duration_sec).sort((a, b) => a - b)
  const cut = Math.max(1, Math.floor(durs.length * 0.99))   // 상위 1% 절단 (한 명이 켜놓고 잔 세션 방지)
  const kept = durs.slice(0, cut)
  const avg = kept.reduce((a, b) => a + b, 0) / kept.length
  const overs = r.filter(x => x.game_overs > 0)
  const anyClear = r.some(x => x.cleared)
  return {
    sessions: n,
    under30sRate: r.filter(x => x.duration_sec < 30).length / n,
    avgDurationSec: Math.round(avg),
    restartRate: overs.length ? r.filter(x => x.game_overs >= 2).length / n : null,
    clearRate: anyClear ? r.filter(x => x.cleared).length / n : null,
  }
}

/** 지표별 상대 개선율 (B/A − 1, 이탈률은 부호 반전). 둘 다 있는 지표만. */
export function compare(a: VersionMetrics, b: VersionMetrics): { score: number; deltas: Record<string, number>; worst: number } {
  const deltas: Record<string, number> = {}
  const rel = (x: number, y: number) => (x > 0 ? y / x - 1 : y > 0 ? 1 : 0)
  // 이탈률: 낮을수록 좋음 → 개선 = −(B/A − 1). A 가 0 이면 B 가 0 일 때만 동일(0), 아니면 악화(−1)
  deltas.dropout = a.under30sRate > 0 ? -(b.under30sRate / a.under30sRate - 1) : (b.under30sRate > 0 ? -1 : 0)
  deltas.duration = rel(a.avgDurationSec, b.avgDurationSec)
  if (a.restartRate != null && b.restartRate != null) deltas.restart = rel(a.restartRate, b.restartRate)
  if (a.clearRate != null && b.clearRate != null) deltas.clear = rel(a.clearRate, b.clearRate)
  // 사용 가능한 지표의 가중치를 재정규화
  let wsum = 0, score = 0
  for (const k of Object.keys(deltas) as (keyof typeof WEIGHTS)[]) { const w = WEIGHTS[k]; wsum += w; score += w * clamp(deltas[k], -1, 1) }
  score = wsum ? score / wsum : 0
  const worst = Math.min(...Object.values(deltas).map(v => clamp(v, -1, 1)))
  return { score: round(score), deltas: Object.fromEntries(Object.entries(deltas).map(([k, v]) => [k, round(v)])), worst: round(worst) }
}

export type Verdict = 'adopt' | 'revert' | 'inconclusive' | 'continue'

export function decide(a: VersionMetrics, b: VersionMetrics, daysElapsed: number, s: DesignSettings = DEFAULT_DESIGN): { verdict: Verdict; score: number; deltas: Record<string, number>; reason: string } {
  const { score, deltas, worst } = compare(a, b)
  // 조기 복귀 — 카나리가 깨졌거나 훨씬 나쁠 때 표본이 차기 전이라도
  if (b.sessions >= s.earlyMinSessions && a.sessions >= s.earlyMinSessions && a.under30sRate > 0 && b.under30sRate > a.under30sRate * s.earlyDropoutX) {
    return { verdict: 'revert', score, deltas, reason: `조기 복귀: 30초 이탈률 ${pct(b.under30sRate)} vs 라이브 ${pct(a.under30sRate)} (${s.earlyDropoutX}배 초과)` }
  }
  const enough = a.sessions >= s.minSessions && b.sessions >= s.minSessions
  if (enough) {
    if (score >= s.adoptAt && worst > s.worstAllowed) return { verdict: 'adopt', score, deltas, reason: `복합 점수 ${sign(score)} (채택 기준 +${pct(s.adoptAt)}) · 최악 지표 ${sign(worst)}` }
    if (score <= s.revertAt) return { verdict: 'revert', score, deltas, reason: `복합 점수 ${sign(score)} (복귀 기준 ${pct(s.revertAt)})` }
    if (daysElapsed >= s.maxDays) return { verdict: 'inconclusive', score, deltas, reason: `기간 만료 · 복합 점수 ${sign(score)} — 차이 없음` }
    return { verdict: 'continue', score, deltas, reason: `표본 충분, 판정 대기 (복합 ${sign(score)})` }
  }
  if (daysElapsed >= s.maxDays) return { verdict: 'inconclusive', score, deltas, reason: `기간 만료 · 표본 부족 (라이브 ${a.sessions}, 카나리 ${b.sessions} / 각 ${s.minSessions} 필요)` }
  return { verdict: 'continue', score, deltas, reason: `표본 수집 중 (라이브 ${a.sessions}, 카나리 ${b.sessions} / 각 ${s.minSessions} 필요)` }
}

/** 생성된 HTML 이 게임 계약(조작 채널)을 그대로 유지했는지 — inputs 키 집합 비교 */
export function inputKeys(html: string): string[] | null {
  const m = /inputs\s*:\s*\{/.exec(html)
  if (!m) return null
  // 중괄호 깊이를 세어 inputs 블록 전체를 잘라낸다 (메서드 본문의 {} 에서 끊기지 않게)
  let depth = 1, i = m.index + m[0].length
  const start = i
  for (; i < html.length && depth > 0; i++) { const c = html[i]; if (c === '{') depth++; else if (c === '}') depth--; }
  const body = html.slice(start, i - 1)
  // 최상위(깊이 0) 키만: `name(` 또는 `name:` 형태
  const keys = new Set<string>()
  let d = 0, j = 0, expectKey = true
  while (j < body.length) {
    const c = body[j]
    if (c === '{' || c === '(' || c === '[') { d++; j++; continue }
    if (c === '}' || c === ')' || c === ']') { d--; j++; continue }
    if (d > 0) { j++; continue }
    if (c === ',') { expectKey = true; j++; continue }
    if (expectKey && /[A-Za-z_$]/.test(c)) {
      let k = j; while (k < body.length && /[A-Za-z0-9_$]/.test(body[k])) k++
      const ident = body.slice(j, k)
      let w = k; while (w < body.length && /\s/.test(body[w])) w++
      if (body[w] === '(' || body[w] === ':') { keys.add(ident); expectKey = false }
      j = k; continue
    }
    j++
  }
  return [...keys].sort()
}

export function contractGate(baseHtml: string, candHtml: string, baseBytes: number): { ok: boolean; reason?: string } {
  const ratio = candHtml.length / Math.max(1, baseBytes)
  if (ratio < 0.5 || ratio > 2.0) return { ok: false, reason: `크기 비율 ${ratio.toFixed(2)} (0.5~2.0 허용)` }
  if (!/<title>[^<]{1,80}<\/title>/i.test(candHtml)) return { ok: false, reason: '<title> 없음' }
  const hadContract = /VIBREX_GAME\s*=/.test(baseHtml)
  if (hadContract && !/VIBREX_GAME\s*=/.test(candHtml)) return { ok: false, reason: 'VIBREX_GAME 매니페스트가 사라짐' }
  const a = inputKeys(baseHtml), b = inputKeys(candHtml)
  if (a && b && a.join(',') !== b.join(',')) return { ok: false, reason: `조작 채널 변경 (${a.join('/')} → ${b.join('/')})` }
  if (a && !b) return { ok: false, reason: 'inputs 선언이 사라짐' }
  return { ok: true }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round = (v: number) => Math.round(v * 1000) / 1000
const pct = (v: number) => `${Math.round(v * 100)}%`
const sign = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`
