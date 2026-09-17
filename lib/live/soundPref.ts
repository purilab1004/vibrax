'use client'
// 쇼츠 공용 스피커 설정 — 배경음·영상 소리를 함께 켜고 끈다. 한 번 켜면 게임·영상 쇼츠 모두 켜진 채로 이어진다(localStorage 기억, 기본 켜짐).
import { useEffect, useState } from 'react'

export interface SoundPref { on: boolean; volume: number }
const KEY = 'vbx_live_sound'
let pref: SoundPref = { on: true, volume: 70 }
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
export function subscribeSoundPref(f: (p: SoundPref) => void): () => void { listeners.add(f); return () => { listeners.delete(f) } }
export function useSoundPref(): SoundPref {
  const [p, setP] = useState<SoundPref>(() => (typeof window === 'undefined' ? pref : load()))
  useEffect(() => { listeners.add(setP); return () => { listeners.delete(setP) } }, [])
  return p
}
