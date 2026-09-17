// lib/broadcast.ts — 제작자 라이브 방송 설정(아바타 대신 실제 영상으로 BJ). YouTube/Twitch 링크 → 임베드 URL.
export interface BroadcastSetting {
  mode: 'avatar' | 'camera' | 'live' // camera = 폰 카메라 WebRTC, live = 링크(YouTube/Twitch) 임베드
  url: string      // 링크 방송 원본 링크
  on: boolean      // ON AIR — 켜져 있을 때만 게임에서 영상이 나온다
  gameId?: string | null // 추천 게임 — 이 게임 카드에 방송이 나오고, 코인을 넣으면 이 게임을 플레이
  screenOn?: boolean // 게임 화면 방송(캔버스 캡처) 중 — 시청자는 게임 페이지에서 이 회원의 플레이를 본다(직접 플레이 불가)
}

export const DEFAULT_BROADCAST: BroadcastSetting = { mode: 'avatar', url: '', on: false }

/** 링크 방송은 여러 개 추가 가능 — 각각 게임을 연결하고 개별 ON/OFF */
export interface LinkBroadcast { id: string; url: string; gameId: string | null; on: boolean; title?: string; kind?: 'live' | 'video'; note?: string; videoTitle?: string } // note = 한 줄 소개, videoTitle = 영상 제목(oEmbed 자동, 수정 가능) — 쇼츠 카드 제작자 아래 표시 // kind 생략 = live(라이브 링크), video = 일반 영상 공유
export function parseLinkBroadcasts(raw: unknown): LinkBroadcast[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r) => {
    if (!r || typeof r !== 'object') return []
    const o = r as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.url !== 'string') return []
    return [{ id: o.id, url: o.url.slice(0, 500), gameId: typeof o.gameId === 'string' ? o.gameId : null, on: o.on === true, title: typeof o.title === 'string' ? o.title.slice(0, 80) : undefined, kind: (o.kind === 'video' ? 'video' : 'live') as 'live' | 'video', note: typeof o.note === 'string' ? o.note.slice(0, 80) : undefined, videoTitle: typeof o.videoTitle === 'string' ? o.videoTitle.slice(0, 120) : undefined }]
  }).slice(0, 20)
}

export function parseBroadcast(raw: unknown): BroadcastSetting | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    mode: r.mode === 'camera' ? 'camera' : r.mode === 'live' ? 'live' : 'avatar',
    url: typeof r.url === 'string' ? r.url.slice(0, 500) : '',
    on: r.on === true,
    gameId: typeof r.gameId === 'string' ? r.gameId : null,
    screenOn: r.screenOn === true,
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
  const yt = (id: string): Embed => ({ src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${id}&enablejsapi=1&controls=0&disablekb=1&fs=0&iv_load_policy=3`, kind: 'youtube', aspect: shorts ? 9 / 16 : 16 / 9 })
  if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return id ? yt(id) : null }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v'); if (v) return yt(v)
    const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/); if (m) return yt(m[1])
    const ch = u.pathname.match(/^\/channel\/([\w-]+)/)
    if (ch) return { src: `https://www.youtube.com/embed/live_stream?channel=${ch[1]}&autoplay=1&mute=1&playsinline=1&enablejsapi=1&controls=0&disablekb=1&fs=0&iv_load_policy=3`, kind: 'youtube', aspect: 16 / 9 }
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
export type LiveInfo = { kind: 'camera'; hostId: string; cam: boolean; screen: boolean } | { kind: 'link'; hostId: string; src: string; aspect: number; video?: boolean } // cam = 폰 카메라(BJ 자리), screen = 게임 화면 방송(관전); video = 라이브가 아닌 일반 영상
export function liveInfoOf(b: BroadcastSetting | undefined | null, hostId: string): LiveInfo | null {
  if (!b) return null
  const cam = b.mode === 'camera' && b.on, screen = !!b.screenOn
  if (cam || screen) return { kind: 'camera', hostId, cam, screen }
  if (b.mode === 'live' && b.on) { const e = toEmbed(b.url); if (e) return { kind: 'link', hostId, src: e.src, aspect: e.aspect } }
  return null
}

/** 폰 카메라(WebRTC) 방송 중인지 */
export function isCameraOn(b: BroadcastSetting | undefined | null): b is BroadcastSetting {
  return !!b && b.mode === 'camera' && b.on
}

// ── WebRTC 시그널링 (Supabase Realtime broadcast 채널 `live:{hostUserId}`) ──
// STUN 만으로는 폰(5G)↔PC(와이파이)처럼 다른 망 사이 연결이 자주 실패한다 → TURN(중계) 서버도 넣는다.
// 환경변수 NEXT_PUBLIC_TURN_URLS(쉼표 구분)/NEXT_PUBLIC_TURN_USER/NEXT_PUBLIC_TURN_PASS 가 있으면 그것을, 없으면 Open Relay 공개 TURN 을 쓴다.
const envTurn = (): RTCIceServer[] => {
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!urls.length) return []
  return [{ urls, username: process.env.NEXT_PUBLIC_TURN_USER ?? '', credential: process.env.NEXT_PUBLIC_TURN_PASS ?? '' }]
}
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  ...(envTurn().length ? envTurn() : [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ]),
]
export type Signal =
  | { type: 'join'; from: string }                            // 시청자 → 호스트
  | { type: 'offer'; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'bye'; from: string }
export type LiveChannelKind = 'cam' | 'screen'
export const liveChannelName = (hostUserId: string, kind: LiveChannelKind = 'cam') => kind === 'screen' ? `live:${hostUserId}:screen` : `live:${hostUserId}`
