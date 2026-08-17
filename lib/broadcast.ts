// lib/broadcast.ts — 제작자 라이브 방송 설정(아바타 대신 실제 영상으로 BJ). YouTube/Twitch 링크 → 임베드 URL.
export interface BroadcastSetting {
  mode: 'avatar' | 'camera' // camera = 폰 카메라 WebRTC (/broadcast)
  url: string      // (예약) 링크 방송용 — 현재 미사용
  on: boolean      // ON AIR — 켜져 있을 때만 게임에서 영상이 나온다
  gameId?: string | null // 추천 게임 — 이 게임 카드에 방송이 나오고, 코인을 넣으면 이 게임을 플레이
}

export const DEFAULT_BROADCAST: BroadcastSetting = { mode: 'avatar', url: '', on: false }

export function parseBroadcast(raw: unknown): BroadcastSetting | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    mode: r.mode === 'camera' ? 'camera' : 'avatar',
    url: typeof r.url === 'string' ? r.url.slice(0, 500) : '',
    on: r.on === true,
    gameId: typeof r.gameId === 'string' ? r.gameId : null,
  }
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


/** 이 게임 카드에 방송을 보여줘야 하면 호스트 user id, 아니면 null */
export function liveHostForGame(b: BroadcastSetting | undefined | null, gameId: string, hostUserId: string): string | null {
  return isCameraOn(b) && b.gameId === gameId ? hostUserId : null
}
