// Pure timing math: turn TTS per-word timings into an `aa` expression track for a talking mouth.
export interface VisemeKey { t: number; value: number }

const OPEN = 0.7

export function buildVisemeTrack(words: string[], wtimes: number[], wdurations: number[]): VisemeKey[] {
  if (words.length === 0) return [{ t: 0, value: 0 }]
  const keys: VisemeKey[] = []
  for (let i = 0; i < words.length; i++) {
    const start = wtimes[i] ?? 0
    const dur = wdurations[i] ?? 0
    keys.push({ t: start + dur * 0.2, value: OPEN })
    keys.push({ t: start + dur, value: 0 })
  }
  keys.sort((a, b) => a.t - b.t)
  if (keys[keys.length - 1].value !== 0) keys.push({ t: keys[keys.length - 1].t + 1, value: 0 })
  return keys
}

export function sampleViseme(track: VisemeKey[], tMs: number): number {
  if (track.length === 0) return 0
  if (tMs <= track[0].t) return track[0].value
  if (tMs >= track[track.length - 1].t) return track[track.length - 1].value
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1], b = track[i]
    if (tMs <= b.t) {
      const span = b.t - a.t || 1
      const f = (tMs - a.t) / span
      return a.value + (b.value - a.value) * f
    }
  }
  return 0
}
