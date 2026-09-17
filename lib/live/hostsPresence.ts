'use client'
// lib/live/hostsPresence.ts — "지금 실제로 방송 중인 호스트" presence 를 한 채널 인스턴스로 관리(클라이언트당 1개).
// 같은 토픽 채널을 여러 번 만들면 supabase-js 가 기존 채널을 돌려주고 subscribe 가 중복돼 presence 가 꼬인다 → 호스트(내가 방송)·시청(목록) 모두 여기만 쓴다.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { LIVE_HOSTS_CHANNEL } from '@/lib/broadcast'

type HostKind = 'cam' | 'screen'
let ch: RealtimeChannel | null = null
let joined = false
let ready = false
let online = new Set<string>()
const mine = new Map<string, { hostId: string; kind: HostKind }>()   // 이 기기에서 송출 중인 방송
const subs = new Set<() => void>()

function syncTrack() {
  if (!ch || !joined) return
  const hosts = [...mine.values()]
  if (hosts.length) ch.track({ hosts }).catch(() => {})
  else ch.untrack().catch(() => {})
}

function ensure() {
  if (ch || typeof window === 'undefined') return
  const key = `c_${Math.random().toString(36).slice(2, 10)}`
  ch = createClient().channel(LIVE_HOSTS_CHANNEL, { config: { presence: { key } } })
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch!.presenceState() as Record<string, { hosts?: { hostId?: string }[] }[]>
    const next = new Set<string>()
    for (const arr of Object.values(st)) for (const p of arr) for (const h of p.hosts ?? []) if (h.hostId) next.add(h.hostId)
    for (const h of mine.values()) next.add(h.hostId)   // 내 방송은 서버 반영 전에도 온라인
    online = next; ready = true
    subs.forEach((f) => f())
  })
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') { joined = true; syncTrack() } })
}

export function subscribeHostsPresence(f: () => void): () => void { ensure(); subs.add(f); return () => { subs.delete(f) } }
export function hostsPresenceReady(): boolean { return ready }
export function isHostOnline(hostId: string): boolean { return online.has(hostId) || [...mine.values()].some((h) => h.hostId === hostId) }

/** 방송 시작 시 호출 — 반환 함수로 해제 */
export function trackHost(hostId: string, kind: HostKind): () => void {
  ensure()
  const id = `${hostId}:${kind}:${Math.random().toString(36).slice(2, 6)}`
  mine.set(id, { hostId, kind })
  syncTrack(); subs.forEach((f) => f())
  return () => { mine.delete(id); syncTrack(); subs.forEach((f) => f()) }
}
