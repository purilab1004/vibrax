// Paddle 웹훅 발신 IP 허용목록 — https://api.paddle.com/ips (라이브) / https://sandbox-api.paddle.com/ips 를 런타임에 조회·캐시 (하드코딩 금지)
let cache: { at: number; env: string; ips: Set<string> } | null = null

export async function paddleWebhookIps(): Promise<Set<string> | null> {
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox' ? 'sandbox' : 'production'
  if (cache && cache.env === env && Date.now() - cache.at < 6 * 3600_000) return cache.ips
  try {
    const r = await fetch(env === 'sandbox' ? 'https://sandbox-api.paddle.com/ips' : 'https://api.paddle.com/ips', { cache: 'no-store' })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json() as { data?: { ipv4_cidrs?: string[] } }
    const ips = new Set((j.data?.ipv4_cidrs ?? []).map(c => c.replace(/\/32$/, '')))
    if (!ips.size) throw new Error('empty')
    cache = { at: Date.now(), env, ips }
    return ips
  } catch (e) {
    console.warn('[paddle] ip list fetch failed', e)
    return cache?.ips ?? null  // 조회 실패 시: 캐시가 있으면 사용, 없으면 null(서명 검증만으로 통과)
  }
}

export function requestIp(h: Headers): string {
  const real = h.get('x-real-ip'); if (real) return real.trim()
  const xff = h.get('x-forwarded-for'); return xff ? xff.split(',')[0].trim() : ''
}
