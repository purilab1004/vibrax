'use client'
// 지금 방송 중인 (gameId → hostUserId) 맵. 방송자는 게임 주인이 아닐 수도 있어서(아무 게임이나 추천 가능)
// profiles.avatar_config.broadcast 를 훑어 한 번 받아 두고 30초마다 갱신. 모듈 캐시로 여러 카드가 공유.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseBroadcast, parseLinkBroadcasts, liveInfoOf, toEmbed, type LiveInfo } from '@/lib/broadcast'
import { subscribeHostsPresence, isHostOnline } from '@/lib/live/hostsPresence'
import { avatarPreviewUrl } from '@/lib/jeumto/config'

export type LiveEntry = LiveInfo & { gameId: string; hostName: string; hostAvatarUrl: string | null; hostCountry?: string | null; note?: string | null; videoTitle?: string | null }
export type LiveMap = Record<string, LiveEntry> // key: `${hostId}:${gameId}:${n}`
/** 이 게임을 대상으로 한 라이브 하나 (게임 안 BJ 용) */
export function liveForGame(m: LiveMap, gameId: string): LiveEntry | null {
  return Object.values(m).find((e) => e.gameId === gameId) ?? null
}
let cache: LiveMap = {}
// 지금 접속 중인 방송자(presence) — DB 플래그가 남아 있어도(강제 종료·끊김) 접속이 없으면 카메라 LIVE 카드를 숨긴다
let presenceStarted = false
function startPresence() {
  if (presenceStarted || typeof window === 'undefined') return
  presenceStarted = true
  subscribeHostsPresence(() => { cache = visible(raw); listeners.forEach((l) => l(cache)) })
}
let raw: LiveMap = {}
function visible(m: LiveMap): LiveMap {
  const out: LiveMap = {}
  for (const [k, e] of Object.entries(m)) { if (e.kind === 'camera' && !isHostOnline(e.hostId)) continue; out[k] = e }
  return out
}
let fetchedAt = 0
let inflight: Promise<LiveMap> | null = null
const listeners = new Set<(m: LiveMap) => void>()

async function fetchLive(): Promise<LiveMap> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, agent_name, avatar_config, country')
    .or('avatar_config->broadcast->>on.eq.true,avatar_config->broadcast->>screenOn.eq.true,avatar_config->broadcasts.not.is.null')
    .limit(300)
  const m: LiveMap = {}
  for (const row of (data ?? []) as { id: string; username: string | null; agent_name?: string | null; avatar_config: { broadcast?: unknown } | null; country?: string | null }[]) {
    const hostName = row.agent_name ?? row.username ?? 'LIVE'
    const hostAvatarUrl = avatarPreviewUrl(row.avatar_config)
    const b = parseBroadcast(row.avatar_config?.broadcast)
    const info = liveInfoOf(b, row.id)
    const hostCountry = row.country ?? null
    if (info && b?.gameId) m[`${row.id}:${b.gameId}:cam`] = { ...info, gameId: b.gameId, hostName, hostAvatarUrl, hostCountry }
    // 링크 방송 목록 — 켜진 것만
    const links = parseLinkBroadcasts((row.avatar_config as { broadcasts?: unknown } | null)?.broadcasts)
    links.forEach((l, i) => {
      if (!l.on) return
      if (!l.gameId && l.kind !== 'video') return // 라이브 링크는 게임 필수, 일반 영상은 게임 없이도 공유 가능
      const e = toEmbed(l.url); if (!e) return
      m[`${row.id}:${l.gameId ?? ''}:${i}`] = { kind: 'link', hostId: row.id, src: e.src, aspect: e.aspect, gameId: l.gameId ?? '', hostName, hostAvatarUrl, hostCountry, video: l.kind === 'video', note: l.note ?? null, videoTitle: l.videoTitle ?? null }
    })
  }
  raw = m; cache = visible(m); fetchedAt = Date.now()
  listeners.forEach((l) => l(cache))
  return cache
}
export function refreshLiveBroadcasts(): void { ensure(0) }
function ensure(maxAgeMs = 10_000): void {
  if (Date.now() - fetchedAt < maxAgeMs) return
  if (!inflight) inflight = fetchLive().finally(() => { inflight = null })
}

export function useLiveBroadcasts(): LiveMap {
  const [m, setM] = useState<LiveMap>(cache)
  useEffect(() => {
    listeners.add(setM)
    startPresence()
    ensure()
    const iv = setInterval(() => ensure(), 10_000)
    return () => { listeners.delete(setM); clearInterval(iv) }
  }, [])
  return m
}
