// 클라이언트 에러 수집 — window.onerror / unhandledrejection / error boundary
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fingerprintOf } from '@/lib/log/server'

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { message?: string; stack?: string; path?: string; level?: string; meta?: Record<string, unknown> } | null
  if (!b?.message) return new Response(null, { status: 204 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const msg = String(b.message).slice(0, 2000)
  const fp = fingerprintOf(msg, b.path)
  // 같은 지문 폭주 방지: 최근 1분 내 20건 이상이면 버림
  const { count } = await admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('fingerprint', fp).gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= 20) return new Response(null, { status: 204 })
  await admin.from('app_errors').insert([{ level: b.level === 'warn' ? 'warn' : 'error', source: 'client', message: msg, stack: b.stack?.slice(0, 8000) ?? null, path: b.path?.slice(0, 500) ?? null, user_id: user?.id ?? null, user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null, meta: b.meta ?? null, fingerprint: fp }] as never)
  return new Response(null, { status: 204 })
}
