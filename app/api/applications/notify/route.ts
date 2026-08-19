// 신청서 접수 알림 — 폼 저장 직후 호출. 자동화 on: 관리자 메일 발송, off: 대시보드 검토 대기로만.
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAuto, logAutomation } from '@/lib/automation'
import { sendAdminMail, kvHtml } from '@/lib/mail'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'
import { requestIp } from '@/lib/security/log'

const ADMIN_URL = (process.env.ADMIN_HOST ? `https://${process.env.ADMIN_HOST}` : 'https://vibrexcup.com') + '/admin/applications'
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { kind?: 'tournament' | 'partner'; id?: string } | null
  if (!b?.id || (b.kind !== 'tournament' && b.kind !== 'partner')) return Response.json({ error: 'bad request' }, { status: 400 })
  if (!rateLimit(`appnotify:${requestIp(req.headers) ?? 'x'}`, 10, 600_000).ok) return tooMany()
  const admin = createAdminClient()
  const table = b.kind === 'tournament' ? 'tournament_applications' : 'partner_applications'
  const { data } = await admin.from(table).select('*').eq('id', b.id).maybeSingle()
  const row = data as Record<string, unknown> | null
  if (!row) return Response.json({ error: 'not found' }, { status: 404 })
  // 재전송 방지 — 방금(2분 내) 생성된 신청서만, 그리고 같은 id 로는 1회만 알림
  if (Date.now() - new Date(String(row.created_at)).getTime() > 120_000) return Response.json({ ok: true, mailed: false })
  if (!rateLimit(`appnotify:id:${b.id}`, 1, 86400_000).ok) return Response.json({ ok: true, mailed: false })
  // 토너먼트 신청은 본인만 알림 트리거 가능 (파트너 신청은 비회원 가능)
  if (b.kind === 'tournament') { const { data: { user } } = await (await createClient()).auth.getUser(); if (!user || user.id !== row.user_id) return Response.json({ error: 'forbidden' }, { status: 403 }) }
  const label = b.kind === 'tournament' ? `토너먼트 신청 · ${row.division}` : `파트너 신청 · ${row.org_type}`
  const who = b.kind === 'tournament' ? `${row.name} (${row.email})` : `${row.org_name} / ${row.contact_name} (${row.email})`
  if (!(await isAuto('applications.emailAdmin'))) { await logAutomation({ module: 'applications', action: `${label} 접수 — 확인 필요`, target: who, status: 'needs_review', detail: { id: b.id } }); return Response.json({ ok: true, mailed: false }) }
  const rows: [string, unknown][] = Object.entries(row).filter(([k]) => !['id', 'user_id'].includes(k)).map(([k, v]) => [k, v])
  const r = await sendAdminMail(`[Vibrex] 새 ${label} — ${who}`, kvHtml(`새 ${label}`, rows, ADMIN_URL))
  await logAutomation({ module: 'applications', action: r.ok ? `${label} 접수 → 관리자 메일 발송` : r.skipped ? `${label} 접수 (메일 미설정 — 확인 필요)` : `${label} 접수 — 메일 발송 실패`, target: who, status: r.ok ? 'ok' : r.skipped ? 'needs_review' : 'error', detail: { id: b.id, error: r.error } })
  return Response.json({ ok: true, mailed: r.ok })
}
