'use client'
// 지금 방송 중인 (gameId → hostUserId) 맵. 방송자는 게임 주인이 아닐 수도 있어서(아무 게임이나 추천 가능)
// profiles.avatar_config.broadcast 를 훑어 한 번 받아 두고 30초마다 갱신. 모듈 캐시로 여러 카드가 공유.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseBroadcast, liveInfoOf, type LiveInfo } from '@/lib/broadcast'

export type LiveMap = Record<string, LiveInfo>
let cache: LiveMap = {}
let fetchedAt = 0
let inflight: Promise<LiveMap> | null = null
const listeners = new Set<(m: LiveMap) => void>()

async function fetchLive(): Promise<LiveMap> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, avatar_config')
    .filter('avatar_config->broadcast->>on', 'eq', 'true')
    .limit(200)
  const m: LiveMap = {}
  for (const row of (data ?? []) as { id: string; avatar_config: { broadcast?: unknown } | null }[]) {
    const b = parseBroadcast(row.avatar_config?.broadcast)
    const info = liveInfoOf(b, row.id)
    if (info && b?.gameId) m[b.gameId] = info
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
