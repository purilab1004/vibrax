// 간단 레이트 리미터 — 인스턴스 메모리(슬라이딩 윈도). 서버리스 인스턴스마다 따로지만 LLM 남용·스팸을 1차 차단한다.
const buckets = new Map<string, number[]>()
let sweep = 0
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  if (++sweep % 500 === 0) for (const [k, arr] of buckets) { if (!arr.length || arr[arr.length - 1] < now - windowMs) buckets.delete(k) }
  const arr = (buckets.get(key) ?? []).filter(t => t > now - windowMs)
  if (arr.length >= max) { buckets.set(key, arr); return { ok: false, remaining: 0 } }
  arr.push(now); buckets.set(key, arr)
  return { ok: true, remaining: max - arr.length }
}
export const tooMany = () => Response.json({ error: 'too many requests' }, { status: 429 })

/** 봇 정책 cond 검증 — s.필드, 숫자, 비교/산술/논리 연산자, Math 일부, 괄호만 허용 (문자열·대괄호·식별자 호출 불가) */
const COND_TOKEN = /^(?:\s+|s(?:\.[A-Za-z_]\w*)+|Math\.(?:abs|min|max|floor|ceil|round|sqrt|sign|hypot)(?=\()|\d+(?:\.\d+)?|true|false|null|===|!==|==|!=|<=|>=|&&|\|\||[-+*/%<>!?:(),])/
export function isSafeCond(cond: string): boolean {
  if (typeof cond !== 'string' || cond.length === 0 || cond.length > 200) return false
  if (/\b(constructor|__proto__|prototype|__defineGetter__|__lookupGetter__)\b/.test(cond)) return false
  let rest = cond, depth = 0
  while (rest.length) {
    const m = COND_TOKEN.exec(rest)
    if (!m) return false
    if (m[0] === '(') depth++
    if (m[0] === ')') { depth--; if (depth < 0) return false }
    rest = rest.slice(m[0].length)
  }
  return depth === 0
}
