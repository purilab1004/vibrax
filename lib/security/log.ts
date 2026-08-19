// 보안 이벤트 로그 + IP 해시(원문 미저장). 실패해도 요청 흐름을 막지 않는다.
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const ipHash = (ip: string | null | undefined) => ip ? createHash('sha256').update(`${process.env.IP_HASH_SALT ?? 'vibrex'}|${ip}`).digest('hex').slice(0, 24) : null
export const requestIp = (h: Headers) => h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0].trim() || null

export async function logSecurity(kind: string, opts: { severity?: 'info' | 'warn' | 'high'; headers?: Headers; userId?: string | null; path?: string; detail?: Record<string, unknown> } = {}) {
  try {
    await createAdminClient().from('security_events').insert([{ kind, severity: opts.severity ?? 'warn', ip_hash: opts.headers ? ipHash(requestIp(opts.headers)) : null, user_id: opts.userId ?? null, path: opts.path ?? null, detail: opts.detail ?? null }] as never)
  } catch { /* ignore */ }
}
