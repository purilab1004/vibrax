// lib/broadcast.ts — 제작자 라이브 방송 설정(아바타 대신 실제 영상으로 BJ). YouTube/Twitch 링크 → 임베드 URL.
export interface BroadcastSetting {
  mode: 'avatar' | 'live'
  url: string      // 사용자가 붙여넣은 원본 링크
  on: boolean      // ON AIR — 켜져 있을 때만 게임에서 영상이 나온다
}

export const DEFAULT_BROADCAST: BroadcastSetting = { mode: 'avatar', url: '', on: false }

export function parseBroadcast(raw: unknown): BroadcastSetting | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  return {
    mode: r.mode === 'live' ? 'live' : 'avatar',
    url: typeof r.url === 'string' ? r.url.slice(0, 500) : '',
    on: r.on === true,
  }
}

export interface Embed { src: string; kind: 'youtube' | 'twitch' | 'iframe' }

/** 링크 → 임베드. 지원: youtube.com/watch?v=, youtu.be/, youtube.com/live/, youtube.com/embed/, twitch.tv/채널, 그 외 https iframe URL */
export function toEmbed(input: string, parentHost = 'vibrexcup.com'): Embed | null {
  const s = (input ?? '').trim()
  if (!s) return null
  let u: URL
  try { u = new URL(s.startsWith('http') ? s : `https://${s}`) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const yt = (id: string) => ({ src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`, kind: 'youtube' as const })
  if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return id ? yt(id) : null }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v'); if (v) return yt(v)
    const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{6,})/); if (m) return yt(m[1])
    const ch = u.pathname.match(/^\/channel\/([\w-]+)/)
    if (ch) return { src: `https://www.youtube.com/embed/live_stream?channel=${ch[1]}&autoplay=1&mute=1&playsinline=1`, kind: 'youtube' }
    return null
  }
  if (host === 'twitch.tv') {
    const ch = u.pathname.split('/').filter(Boolean)[0]
    if (!ch || ch === 'videos') return null
    return { src: `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${parentHost}&muted=true&autoplay=true`, kind: 'twitch' }
  }
  if (u.protocol === 'https:') return { src: u.toString(), kind: 'iframe' }
  return null
}

/** 게임에서 실제로 영상을 보여줘야 하는지 */
export function isLiveOn(b: BroadcastSetting | undefined | null): b is BroadcastSetting {
  return !!b && b.mode === 'live' && b.on && !!toEmbed(b.url)
}
