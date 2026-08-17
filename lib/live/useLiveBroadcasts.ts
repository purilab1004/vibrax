'use client'
// 지금 방송 중인 (gameId → hostUserId) 맵. 방송자는 게임 주인이 아닐 수도 있어서(아무 게임이나 추천 가능)
// profiles.avatar_config.broadcast 를 훑어 한 번 받아 두고 30초마다 갱신. 모듈 캐시로 여러 카드가 공유.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseBroadcast, parseLinkBroadcasts, liveInfoOf, toEmbed, type LiveInfo } from '@/lib/broadcast'
import { avatarPreviewUrl } from '@/lib/jeumto/config'

export type LiveEntry = LiveInfo & { gameId: string; hostName: string; hostAvatarUrl: string | null }
export type LiveMap = Record<string, LiveEntry> // key: `${hostId}:${gameId}:${n}`
/** 이 게임을 대상으로 한 라이브 하나 (게임 안 BJ 용) */
export function liveForGame(m: LiveMap, gameId: string): LiveEntry | null {
  return Object.values(m).find((e) => e.gameId === gameId) ?? null
}
let cache: LiveMap = {}
let fetchedAt = 0
let inflight: Promise<LiveMap> | null = null
const listeners = new Set<(m: LiveMap) => void>()

async function fetchLive(): Promise<LiveMap> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, agent_name, avatar_config')
    .or('avatar_config->broadcast->>on.eq.true,avatar_config->broadcasts.not.is.null')
    .limit(300)
  const m: LiveMap = {}
  for (const row of (data ?? []) as { id: string; username: string | null; agent_name?: string | null; avatar_config: { broadcast?: unknown } | null }[]) {
    const hostName = row.agent_name ?? row.username ?? 'LIVE'
    const hostAvatarUrl = avatarPreviewUrl(row.avatar_config)
    const b = parseBroadcast(row.avatar_config?.broadcast)
    const info = liveInfoOf(b, row.id)
    if (info && b?.gameId) m[`${row.id}:${b.gameId}:cam`] = { ...info, gameId: b.gameId, hostName, hostAvatarUrl }
    // 링크 방송 목록 — 켜진 것만
    const links = parseLinkBroadcasts((row.avatar_config as { broadcasts?: unknown } | null)?.broadcasts)
    links.forEach((l, i) => {
      if (!l.on || !l.gameId) return
      const e = toEmbed(l.url); if (!e) return
      m[`${row.id}:${l.gameId}:${i}`] = { kind: 'link', hostId: row.id, src: e.src, aspect: e.aspect, gameId: l.gameId, hostName, hostAvatarUrl }
    })
  }
  cache = m; fetchedAt = Date.now()
  listeners.forEach((l) => l(m))
  return m
}
function ensure(maxAgeMs = 30_000): void {
  if (Date.now() - fetchedAt < maxAgeMs) return
  if (!inflight) inflight = fetchLive().finally(() => { inflight = null })
}

export function useLiveBroadcasts(): LiveMap {
  const [m, setM] = useState<LiveMap>(cache)
  useEffect(() => {
    listeners.add(setM)
    ensure()
    const iv = setInterval(() => ensure(), 30_000)
    return () => { listeners.delete(setM); clearInterval(iv) }
  }, [])
  return m
}
