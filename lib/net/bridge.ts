// lib/net/bridge.ts — 온라인(멀티플레이) 브리지. 게임은 샌드박스 iframe(default-src 'none') 안에서 네트워크를 쓸 수 없으므로
// 호스트 페이지가 Supabase Realtime(브로드캐스트 + 프레즌스)을 대신 열고, iframe 과는 postMessage 로 중계한다.
//   게임 → 호스트: { type:'vibrex:net', op:'hello'|'join'|'leave'|'send'|'update', room, ... }
//   호스트 → 게임: { type:'vibrex:net', ev:'ready'|'joined'|'peers'|'msg'|'left'|'error', room, ... }
// 채널 이름은 vbx:{gameId}:{room} — 같은 게임의 같은 방 이름끼리만 만난다. 서버 없이 P2P(호스트 플레이어 = 가장 먼저 들어온 사람)로 진행한다.
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export interface NetIdentity { gameId: string; name: string; userId?: string | null }
export interface NetPeer { id: string; name: string; meta: Record<string, unknown>; joinedAt: number }

const MAX_ROOMS = 4              // 게임 하나가 동시에 여는 채널 수 (로비 + 방 정도)
const MAX_MSG_PER_SEC = 25       // 게임 → 네트워크 전송 상한 (보드 동기화 150ms 간격 + 공격 등)
const MAX_PAYLOAD = 16_000       // 바이트 (보드 20×10 + 여유)

function cleanRoom(r: unknown): string | null {
  const s = String(r ?? '').trim()
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : null
}

export function createNetBridge(supabase: SupabaseClient, ident: NetIdentity) {
  const clientId = `${(ident.userId ?? 'g').slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`
  const rooms = new Map<string, { ch: RealtimeChannel; meta: Record<string, unknown>; joinedAt: number }>()
  let target: Window | null = null
  let sent: number[] = []

  const post = (msg: Record<string, unknown>) => { try { target?.postMessage({ type: 'vibrex:net', ...msg }, '*') } catch { /* noop */ } }
  const peersOf = (room: string): NetPeer[] => {
    const r = rooms.get(room); if (!r) return []
    const st = r.ch.presenceState() as Record<string, { name?: string; meta?: Record<string, unknown>; joinedAt?: number; id?: string }[]>
    const out: NetPeer[] = []
    for (const [key, arr] of Object.entries(st)) {
      const p = arr[0]; if (!p) continue
      out.push({ id: p.id ?? key, name: String(p.name ?? 'PLAYER').slice(0, 16), meta: p.meta ?? {}, joinedAt: Number(p.joinedAt ?? 0) })
    }
    return out.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  }

  const join = async (room: string, meta: Record<string, unknown>) => {
    if (rooms.has(room)) { await update(room, meta); post({ ev: 'joined', room, me: { id: clientId, name: ident.name }, peers: peersOf(room) }); return }
    if (rooms.size >= MAX_ROOMS) { post({ ev: 'error', room, error: 'too_many_rooms' }); return }
    const joinedAt = Date.now()
    const ch = supabase.channel(`vbx:${ident.gameId}:${room}`, { config: { broadcast: { self: false, ack: false }, presence: { key: clientId } } })
    const entry = { ch, meta, joinedAt }
    rooms.set(room, entry)
    ch.on('broadcast', { event: 'g' }, ({ payload }) => {
      const p = payload as { from?: string; to?: string | null; event?: string; data?: unknown } | null
      if (!p || (p.to && p.to !== clientId)) return
      post({ ev: 'msg', room, from: p.from, event: p.event, data: p.data })
    })
    ch.on('presence', { event: 'sync' }, () => post({ ev: 'peers', room, peers: peersOf(room) }))
    ch.on('presence', { event: 'leave' }, ({ key }) => post({ ev: 'left', room, id: key }))
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ id: clientId, name: ident.name, meta, joinedAt })
        post({ ev: 'joined', room, me: { id: clientId, name: ident.name }, peers: peersOf(room) })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        post({ ev: 'error', room, error: status.toLowerCase() })
      }
    })
  }
  const update = async (room: string, meta: Record<string, unknown>) => {
    const r = rooms.get(room); if (!r) return
    r.meta = { ...r.meta, ...meta }
    try { await r.ch.track({ id: clientId, name: ident.name, meta: r.meta, joinedAt: r.joinedAt }) } catch { /* noop */ }
  }
  const leave = async (room: string) => {
    const r = rooms.get(room); if (!r) return
    rooms.delete(room)
    try { await r.ch.untrack(); await supabase.removeChannel(r.ch) } catch { /* noop */ }
    post({ ev: 'left', room, id: clientId, me: true })
  }
  const send = (room: string, event: string, data: unknown, to: string | null) => {
    const r = rooms.get(room); if (!r) return
    const now = Date.now(); sent = sent.filter(t => now - t < 1000)
    if (sent.length >= MAX_MSG_PER_SEC) return
    let size = 0; try { size = JSON.stringify(data ?? null).length } catch { return }
    if (size > MAX_PAYLOAD) return
    sent.push(now)
    r.ch.send({ type: 'broadcast', event: 'g', payload: { from: clientId, to: to || null, event: String(event).slice(0, 32), data } }).catch(() => {})
  }

  return {
    clientId,
    /** iframe 에서 온 message 이벤트를 처리한다. 브리지가 담당하는 메시지면 true */
    handle(e: MessageEvent, frame: Window | null | undefined): boolean {
      const d = e.data as { type?: string; op?: string; room?: unknown; meta?: unknown; event?: unknown; data?: unknown; to?: unknown } | null
      if (!d || d.type !== 'vibrex:net' || !d.op) return false
      if (frame && e.source !== frame) return false
      target = (e.source as Window | null) ?? frame ?? null
      const meta = (d.meta && typeof d.meta === 'object' ? d.meta : {}) as Record<string, unknown>
      if (d.op === 'hello') { post({ ev: 'ready', me: { id: clientId, name: ident.name } }); return true }
      const room = cleanRoom(d.room)
      if (!room) { post({ ev: 'error', room: String(d.room ?? ''), error: 'bad_room' }); return true }
      if (d.op === 'join') void join(room, meta)
      else if (d.op === 'update') void update(room, meta)
      else if (d.op === 'leave') void leave(room)
      else if (d.op === 'send') send(room, String(d.event ?? 'msg'), d.data, typeof d.to === 'string' ? d.to : null)
      return true
    },
    detach() { for (const room of [...rooms.keys()]) void leave(room); target = null },
  }
}
