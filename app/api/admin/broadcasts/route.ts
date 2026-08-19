// 관리자 방송 관리 — 모든 회원의 카메라/링크 방송 목록, 강제 종료·링크 삭제
import { requireAdmin } from '@/lib/admin/guard'
import { parseLinkBroadcasts } from '@/lib/broadcast'

interface Cfg { broadcast?: { mode?: string; url?: string; on?: boolean; gameId?: string | null }; broadcasts?: unknown; name?: string; previewUrl?: string }

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data: profs } = await g.admin.from('profiles').select('id,username,agent_name,avatar_config,role').not('avatar_config', 'is', null).limit(2000)
  const rows = ((profs ?? []) as { id: string; username: string | null; agent_name: string | null; avatar_config: Cfg | null; role: string }[])
  const items: { hostId: string; host: string; avatar: string | null; kind: 'camera' | 'link'; id: string | null; url: string | null; gameId: string | null; on: boolean; title?: string }[] = []
  for (const p of rows) {
    const c = p.avatar_config ?? {}
    const host = p.agent_name ?? p.username ?? p.id.slice(0, 8)
    if (c.broadcast && (c.broadcast.mode === 'camera' || c.broadcast.mode === 'live') && (c.broadcast.on || c.broadcast.url)) {
      items.push({ hostId: p.id, host, avatar: c.previewUrl ?? null, kind: c.broadcast.mode === 'camera' ? 'camera' : 'link', id: null, url: c.broadcast.url ?? null, gameId: c.broadcast.gameId ?? null, on: !!c.broadcast.on })
    }
    for (const b of parseLinkBroadcasts(c.broadcasts)) items.push({ hostId: p.id, host, avatar: c.previewUrl ?? null, kind: 'link', id: b.id, url: b.url, gameId: b.gameId, on: b.on, title: b.title })
  }
  const gameIds = [...new Set(items.map(i => i.gameId).filter(Boolean))] as string[]
  const { data: games } = gameIds.length ? await g.admin.from('games').select('id,title,thumbnail_url').in('id', gameIds) : { data: [] }
  const gmap = new Map(((games ?? []) as { id: string; title: string; thumbnail_url: string }[]).map(x => [x.id, x]))
  return Response.json({ items: items.map(i => ({ ...i, game: i.gameId ? gmap.get(i.gameId) ?? null : null })), live: items.filter(i => i.on).length })
}

// PATCH { hostId, kind, id?, action: 'off' | 'remove' }
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { hostId?: string; kind?: 'camera' | 'link'; id?: string | null; action?: 'off' | 'remove' } | null
  if (!b?.hostId || !b.kind || !b.action) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data } = await g.admin.from('profiles').select('avatar_config').eq('id', b.hostId).maybeSingle()
  const cfg = ((data as { avatar_config?: Cfg } | null)?.avatar_config ?? {}) as Cfg & Record<string, unknown>
  if (b.kind === 'camera' || (b.kind === 'link' && !b.id)) {
    if (cfg.broadcast) cfg.broadcast = b.action === 'remove' ? { ...cfg.broadcast, on: false, url: '', mode: 'avatar' } : { ...cfg.broadcast, on: false }
  } else {
    const list = parseLinkBroadcasts(cfg.broadcasts)
    cfg.broadcasts = b.action === 'remove' ? list.filter(x => x.id !== b.id) : list.map(x => x.id === b.id ? { ...x, on: false } : x)
  }
  const { error } = await g.admin.from('profiles').update({ avatar_config: cfg } as never).eq('id', b.hostId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await g.admin.from('app_errors').insert([{ level: 'warn', source: 'server', message: `admin broadcast ${b.action}`, path: '/admin/broadcasts', user_id: g.user.id, meta: b }] as never).then(() => {}, () => {})
  return Response.json({ ok: true })
}
