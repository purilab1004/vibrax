'use client'
// 스튜디오 생성 엔진 선택(관리자) — Max 구독(로컬 워커)의 Opus 5 / Fable 5.1, 또는 API 토큰. 기기에 기억.
import { useSyncExternalStore } from 'react'

export type StudioEngine = 'max-opus' | 'max-fable' | 'api'
export const ENGINE_LABEL: Record<StudioEngine, string> = { 'max-opus': 'Opus 5 · Max', 'max-fable': 'Fable 5.1 · Max', api: 'API 토큰' }
const KEY = 'studio_engine'
const subs = new Set<() => void>()
// 관리자 표시 — EngineSelect 가 관리자 확인에 성공하면 켠다. 서버 권한과는 무관한 UI 힌트.
let adminHint = false
export function markAdmin(v: boolean) { adminHint = v; subs.forEach((f) => f()) }
export function isAdminHint() { return adminHint }
let cur: StudioEngine | null = null

export function getEngine(): StudioEngine {
  if (!isAdminHint()) return 'api'   // 회원 생성은 항상 API 토큰 (서버도 관리자만 Max 워커를 쓴다)
  if (cur) return cur
  try { const v = localStorage.getItem(KEY); if (v === 'max-opus' || v === 'max-fable' || v === 'api') cur = v } catch { /* noop */ }
  return cur ?? 'max-opus'
}
export function setEngine(e: StudioEngine) {
  cur = e
  try { localStorage.setItem(KEY, e) } catch { /* noop */ }
  subs.forEach((f) => f())
}
export function useEngine(): StudioEngine {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, getEngine, () => 'max-opus')
}
