'use client'
// 피드 영상 스피커 설정 — 한 카드에서 소리를 켜면 다음 카드들도 켜진 채로 시작한다(세션 동안 유지, localStorage 에도 기억).
import { useEffect, useState } from 'react'

export interface SoundPref { on: boolean; volume: number }
const KEY = 'vbx_live_sound'
let pref: SoundPref = { on: false, volume: 70 }
let loaded = false
const listeners = new Set<(p: SoundPref) => void>()

function load(): SoundPref {
  if (loaded) return pref
  loaded = true
  try { const raw = localStorage.getItem(KEY); if (raw) { const j = JSON.parse(raw); pref = { on: j.on === true, volume: typeof j.volume === 'number' ? j.volume : 70 } } } catch { /* noop */ }
  return pref
}
export function getSoundPref(): SoundPref { return load() }
export function setSoundPref(next: Partial<SoundPref>): void {
  pref = { ...load(), ...next }
  try { localStorage.setItem(KEY, JSON.stringify(pref)) } catch { /* noop */ }
  listeners.forEach((l) => l(pref))
}
export function useSoundPref(): SoundPref {
  const [p, setP] = useState<SoundPref>(() => (typeof window === 'undefined' ? pref : load()))
  useEffect(() => { listeners.add(setP); return () => { listeners.delete(setP) } }, [])
  return p
}
