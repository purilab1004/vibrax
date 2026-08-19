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
    void autoNotice(fingerprintOf(e.message, opts.path), e.message, opts.path ?? null)
  } catch { /* 로깅 실패는 무시 */ }
}

// 자동 공지 — 같은 오류가 10분 내 5회 이상이면(자동화 on) 안내 공지를 게시한다. 같은 지문으로 6시간 내 1회만.
async function autoNotice(fp: string, message: string, path: string | null) {
  try {
    const { isAuto, logAutomation } = await import('@/lib/automation')
    if (!(await isAuto('notices.autoIssue'))) return
    const admin = createAdminClient()
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { count } = await admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('fingerprint', fp).gte('created_at', since)
    if ((count ?? 0) < 5) return
    const tag = `[auto:${fp}]`
    const { count: dup } = await admin.from('notices').select('id', { count: 'exact', head: true }).like('content', `%${tag}%`).gte('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    if ((dup ?? 0) > 0) return
    const where = path ? `(${path.replace(/^\/api\//, '').split('/')[0]} 기능)` : ''
    const title = `[안내] 일시적인 오류가 감지되어 확인 중입니다 ${where}`.trim()
    const content = `일부 기능${where ? ` ${where}` : ''}에서 일시적인 오류가 반복 감지되어 자동으로 안내드립니다. 현재 원인을 확인하고 있으며, 정상화되는 대로 이 공지를 갱신하겠습니다. 이용에 불편을 드려 죄송합니다.\n\n— Vibrex 운영 자동 알림 ${tag}`
    const { error } = await admin.from('notices').insert([{ title, content, published: true, pinned: false }] as never)
    await logAutomation({ module: 'notices', action: error ? '장애 자동 공지 게시 실패' : '장애 감지 → 안내 공지 자동 게시', target: title, status: error ? 'error' : 'ok', detail: { fingerprint: fp, path, message: message.slice(0, 200), count, error: error?.message } })
  } catch { /* ignore */ }
}
