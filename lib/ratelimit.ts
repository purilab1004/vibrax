// API 요청 수 제한 — IP 당 1분 고정 창. 무단 대량 수집(스크래핑)·생성 API 남용을 막는다.
// 서버 인스턴스 메모리에 세므로 인스턴스가 여러 개면 느슨해진다(대략적인 1차 방어). 정확한 전역 제한이 필요하면 Upstash/Vercel Firewall 로 옮긴다.
type Bucket = { n: number; reset: number }
const buckets = new Map<string, Bucket>()
let lastSweep = 0

export interface RateRule { name: string; limit: number }
/** 경로·메서드 → 규칙 (null = 제한 없음) */
export function ruleFor(pathname: string, method: string): RateRule | null {
  if (!pathname.startsWith('/api/')) return null
  if (/^\/api\/(webhooks|cron)\//.test(pathname)) return null
  if (pathname.startsWith('/api/library/preview/')) return { name: 'preview', limit: 240 }
  if (pathname.startsWith('/api/auth')) return { name: 'auth', limit: 20 }
  // 비용이 드는 생성·LLM 호출
  if (method === 'POST' && /^\/api\/(studio\/generate|designer\/image|gallery\/model3d|tts|avatar|aj\/|ai-bj|studio\/(plan|explain|engine))/.test(pathname)) return { name: 'gen', limit: 20 }
  if (pathname.startsWith('/api/log')) return { name: 'log', limit: 300 }
  return { name: 'api', limit: 240 }
}

/** 허용이면 null, 초과면 다시 시도할 수 있을 때까지 남은 초 */
export function hit(key: string, limit: number, now = Date.now()): number | null {
  if (now - lastSweep > 60_000) { lastSweep = now; for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k) }
  const b = buckets.get(key)
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + 60_000 }); return null }
  if (b.n >= limit) return Math.max(1, Math.ceil((b.reset - now) / 1000))
  b.n++
  return null
}
