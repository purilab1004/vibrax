// 관리자 접속 관리 — 방문 통계(일별 세션/PV, 현재 접속, 페이지·리퍼러·기기·국가), 최근 접속 회원
import { requireAdmin } from '@/lib/admin/guard'

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 7)))
  const since = new Date(Date.now() - days * 864e5).toISOString()
  const { data, error } = await g.admin.from('visits').select('session_id,user_id,path,referrer,country,city,device,browser,os,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20000)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as { session_id: string | null; user_id: string | null; path: string; referrer: string | null; country: string | null; city: string | null; device: string | null; browser: string | null; os: string | null; created_at: string }[]
  const now = Date.now()
  const inc = (m: Record<string, number>, k: string | null | undefined) => { const key = k || '(없음)'; m[key] = (m[key] ?? 0) + 1 }
  const byDay: Record<string, { pv: number; sessions: Set<string>; users: Set<string> }> = {}
  for (let i = days - 1; i >= 0; i--) byDay[new Date(now - i * 864e5).toISOString().slice(0, 10)] = { pv: 0, sessions: new Set(), users: new Set() }
  const pages: Record<string, number> = {}, refs: Record<string, number> = {}, devices: Record<string, number> = {}, browsers: Record<string, number> = {}, countries: Record<string, number> = {}, oss: Record<string, number> = {}
  const online = new Set<string>(); const onlineUsers = new Set<string>()
  const lastByUser = new Map<string, { at: string; path: string; country: string | null; device: string | null; browser: string | null }>()
  for (const r of rows) {
    const d = r.created_at.slice(0, 10)
    if (byDay[d]) { byDay[d].pv++; if (r.session_id) byDay[d].sessions.add(r.session_id); if (r.user_id) byDay[d].users.add(r.user_id) }
    inc(pages, r.path); inc(devices, r.device); inc(browsers, r.browser); inc(countries, r.country); inc(oss, r.os)
    if (r.referrer) { try { inc(refs, new URL(r.referrer).hostname) } catch { inc(refs, r.referrer) } } else inc(refs, '(직접 접속)')
    if (new Date(r.created_at).getTime() > now - 5 * 60_000) { if (r.session_id) online.add(r.session_id); if (r.user_id) onlineUsers.add(r.user_id) }
    if (r.user_id && !lastByUser.has(r.user_id)) lastByUser.set(r.user_id, { at: r.created_at, path: r.path, country: r.country, device: r.device, browser: r.browser })
  }
  const top = (m: Record<string, number>, n = 10) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }))
  const userIds = [...lastByUser.keys()].slice(0, 50)
  const { data: profs } = userIds.length ? await g.admin.from('profiles').select('id,username,agent_name,avatar_config,role').in('id', userIds) : { data: [] }
  const pmap = new Map(((profs ?? []) as { id: string; username: string | null; agent_name: string | null; avatar_config: { previewUrl?: string } | null; role: string }[]).map(p => [p.id, p]))
  const sessions = new Set(rows.map(r => r.session_id).filter(Boolean)).size
  return Response.json({
    days, pv: rows.length, sessions, users: new Set(rows.map(r => r.user_id).filter(Boolean)).size,
    online: online.size, onlineUsers: onlineUsers.size,
    byDay: Object.entries(byDay).map(([day, v]) => ({ day, pv: v.pv, sessions: v.sessions.size, users: v.users.size })),
    pages: top(pages, 12), referrers: top(refs, 8), devices: top(devices, 3), browsers: top(browsers, 6), oss: top(oss, 6), countries: top(countries, 10),
    recentUsers: userIds.map(id => ({ id, ...lastByUser.get(id)!, name: pmap.get(id)?.agent_name ?? pmap.get(id)?.username ?? id.slice(0, 8), avatar: pmap.get(id)?.avatar_config?.previewUrl ?? null, role: pmap.get(id)?.role ?? 'user' })),
    recent: rows.slice(0, 40),
  })
}
