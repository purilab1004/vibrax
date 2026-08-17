// lib/broadcast.ts — 제작자 라이브 방송 설정(아바타 대신 실제 영상으로 BJ). YouTube/Twitch 링크 → 임베드 URL.
export interface BroadcastSetting {
  mode: 'avatar' | 'camera' | 'live' // camera = 폰 카메라 WebRTC, live = 링크(YouTube/Twitch) 임베드
  url: string      // 링크 방송 원본 링크
  on: boolean      // ON AIR — 켜져 있을 때만 게임에서 영상이 나온다
  gameId?: string | null // 추천 게임 — 이 게임 카드에 방송이 나오고, 코인을 넣으면 이 게임을 플레이
}

export const DEFAULT_BROADCAST: BroadcastSetting = { mode: 'avatar', url: '', on: false }

export function parseBroadcast(raw: unknown): BroadcastSetting | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    mode: r.mode === 'camera' ? 'camera' : r.mode === 'live' ? 'live' : 'avatar',
    url: typeof r.url === 'string' ? r.url.slice(0, 500) : '',
    on: r.on === true,
    gameId: typeof r.gameId === 'string' ? r.gameId : null,
  }
}

export interface Embed { src: string; kind: 'youtube' | 'twitch' | 'iframe'; aspect: number } // aspect = w/h (쇼츠 9:16, 그 외 16:9)

/** 링크 → 임베드. 지원: youtube.com/watch?v=, youtu.be/, youtube.com/live/, /embed/, /shorts/, /channel/ID, twitch.tv/채널, 그 외 https URL */
export function toEmbed(input: string, parentHost = 'vibrexcup.com'): Embed | null {
  const s = (input ?? '').trim()
  if (!s) return null
  let u: URL
  try { u = new URL(s.startsWith('http') ? s : `https://${s}`) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const shorts = /\/shorts\//.test(u.pathname)
  const yt = (id: string): Embed => ({ src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${id}`, kind: 'youtube', aspect: shorts ? 9 / 16 : 16 / 9 })
  if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return id ? yt(id) : null }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v'); if (v) return yt(v)
    const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/); if (m) return yt(m[1])
    const ch = u.pathname.match(/^\/channel\/([\w-]+)/)
    if (ch) return { src: `https://www.youtube.com/embed/live_stream?channel=${ch[1]}&autoplay=1&mute=1&playsinline=1`, kind: 'youtube', aspect: 16 / 9 }
    return null
  }
  if (host === 'twitch.tv') {
    const ch = u.pathname.split('/').filter(Boolean)[0]
    if (!ch || ch === 'videos') return null
    return { src: `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${parentHost}&muted=true&autoplay=true`, kind: 'twitch', aspect: 16 / 9 }
  }
  if (u.protocol === 'https:') return { src: u.toString(), kind: 'iframe', aspect: 16 / 9 }
  return null
}

/** 링크 방송 중인지 */
export function isLinkOn(b: BroadcastSetting | undefined | null): b is BroadcastSetting {
  return !!b && b.mode === 'live' && b.on && !!toEmbed(b.url)
}

/** 카드/게임에서 쓰는 라이브 정보 */
export type LiveInfo = { kind: 'camera'; hostId: string } | { kind: 'link'; hostId: string; src: string; aspect: number }
export function liveInfoOf(b: BroadcastSetting | undefined | null, hostId: string): LiveInfo | null {
  if (!b) return null
  if (b.mode === 'camera' && b.on) return { kind: 'camera', hostId }
  if (b.mode === 'live' && b.on) { const e = toEmbed(b.url); if (e) return { kind: 'link', hostId, src: e.src, aspect: e.aspect } }
  return null
}

/** 폰 카메라(WebRTC) 방송 중인지 */
export function isCameraOn(b: BroadcastSetting | undefined | null): b is BroadcastSetting {
  return !!b && b.mode === 'camera' && b.on
}

// ── WebRTC 시그널링 (Supabase Realtime broadcast 채널 `live:{hostUserId}`) ──
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
]
export type Signal =
  | { type: 'join'; from: string }                            // 시청자 → 호스트
  | { type: 'offer'; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'bye'; from: string }
export const liveChannelName = (hostUserId: string) => `live:${hostUserId}`
