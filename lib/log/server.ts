// 서버 에러 로깅 — API/웹훅 catch 블록에서 호출 (실패해도 무시)
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'node:crypto'

export const fingerprintOf = (message: string, path?: string | null) => createHash('sha1').update(`${(message ?? '').slice(0, 200)}|${path ?? ''}`).digest('hex').slice(0, 16)

export async function logServerError(source: 'server' | 'api' | 'webhook', err: unknown, opts: { path?: string; userId?: string | null; meta?: Record<string, unknown>; level?: 'error' | 'warn'; userAgent?: string | null } = {}) {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
    await createAdminClient().from('app_errors').insert([{
      level: opts.level ?? 'error', source, message: e.message.slice(0, 2000), stack: e.stack?.slice(0, 8000) ?? null,
      path: opts.path ?? null, user_id: opts.userId ?? null, user_agent: opts.userAgent ?? null, meta: opts.meta ?? null,
      fingerprint: fingerprintOf(e.message, opts.path),
    }] as never)
  } catch { /* 로깅 실패는 무시 */ }
}
