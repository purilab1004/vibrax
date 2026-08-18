// 관리자 에러 로그 — 목록/그룹/통계, 해결 처리, 삭제
import { requireAdmin } from '@/lib/admin/guard'

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 7)))
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await g.admin.from('app_errors').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(3000)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as { id: string; level: string; source: string; message: string; stack: string | null; path: string | null; user_id: string | null; user_agent: string | null; meta: unknown; fingerprint: string | null; resolved_at: string | null; created_at: string }[]
  const dayAgo = Date.now() - 864e5
  const groups = new Map<string, { fingerprint: string; message: string; source: string; level: string; path: string | null; count: number; count24h: number; users: Set<string>; first: string; last: string; resolved: boolean; sample: typeof rows[number] }>()
  for (const r of rows) {
    const k = r.fingerprint ?? r.id
    const gph = groups.get(k) ?? { fingerprint: k, message: r.message, source: r.source, level: r.level, path: r.path, count: 0, count24h: 0, users: new Set<string>(), first: r.created_at, last: r.created_at, resolved: !!r.resolved_at, sample: r }
    gph.count++; if (new Date(r.created_at).getTime() > dayAgo) gph.count24h++
    if (r.user_id) gph.users.add(r.user_id)
    if (r.created_at < gph.first) gph.first = r.created_at
    if (r.created_at > gph.last) { gph.last = r.created_at; gph.sample = r }
    if (!r.resolved_at) gph.resolved = false
    groups.set(k, gph)
  }
  const byDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) byDay[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0
  for (const r of rows) { const d = r.created_at.slice(0, 10); if (d in byDay) byDay[d]++ }
  return Response.json({
    days, total: rows.length, last24h: rows.filter(r => new Date(r.created_at).getTime() > dayAgo).length,
    unresolved: [...groups.values()].filter(x => !x.resolved).length,
    bySource: rows.reduce<Record<string, number>>((a, r) => { a[r.source] = (a[r.source] ?? 0) + 1; return a }, {}),
    byDay: Object.entries(byDay).map(([day, n]) => ({ day, n })),
    groups: [...groups.values()].map(x => ({ ...x, users: x.users.size })).sort((a, b) => b.last.localeCompare(a.last)),
  })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { fingerprint?: string; resolved?: boolean } | null
  if (!b?.fingerprint) return Response.json({ error: 'bad request' }, { status: 400 })
  const { error } = await g.admin.from('app_errors').update({ resolved_at: b.resolved === false ? null : new Date().toISOString() } as never).eq('fingerprint', b.fingerprint)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { fingerprint?: string; all?: boolean; olderThanDays?: number } | null
  let q = g.admin.from('app_errors').delete()
  if (b?.fingerprint) q = q.eq('fingerprint', b.fingerprint)
  else if (b?.olderThanDays) q = q.lt('created_at', new Date(Date.now() - b.olderThanDays * 864e5).toISOString())
  else if (b?.all) q = q.not('id', 'is', null)
  else return Response.json({ error: 'bad request' }, { status: 400 })
  const { error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
