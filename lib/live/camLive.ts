'use client'
// lib/live/camLive.ts — 폰 카메라 방송을 페이지 밖(앱 전역)에서 유지한다.
// /broadcast 에서 켠 카메라가 '라이브 방송하면서 게임하기'로 게임 페이지(같은 탭, 클라이언트 이동)에 가도 끊기지 않고,
// 게임 화면 우측 하단 BJ 자리에는 WebRTC 왕복 없이 내 로컬 스트림을 바로 보여 준다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { startHost, type HostHandle } from '@/lib/live/host'

interface CamLiveState { hostId: string; stream: MediaStream; host: HostHandle; gameId: string | null; startedAt: number; facing: 'user' | 'environment'; viewers: number }
let state: CamLiveState | null = null
let wake: { release(): Promise<void> } | null = null
let onHide: (() => void) | null = null
let onStop: (() => void) | null = null   // 아바타 얼굴 합성 등 추가 정리
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function subscribeCamLive(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
export function getCamLive(): CamLiveState | null { return state }
/** 내 로컬 카메라 스트림 (방송 중인 본인일 때만) — 시청 컴포넌트가 WebRTC 대신 바로 붙인다 */
export function localCamStream(hostId: string): MediaStream | null { return state && state.hostId === hostId ? state.stream : null }

export async function startCamLive(supabase: SupabaseClient, hostId: string, stream: MediaStream, opts: { gameId: string | null; facing: 'user' | 'environment'; onPageHide?: () => void; onStop?: () => void }) {
  stopCamLive()
  const host = startHost(supabase, hostId, stream, (n) => { if (state) { state.viewers = n; emit() } })
  state = { hostId, stream, host, gameId: opts.gameId, startedAt: Date.now(), facing: opts.facing, viewers: 0 }
  // 탭을 닫거나 새로고침하면 방송 OFF 저장 (같은 탭 안의 페이지 이동에선 유지)
  onHide = opts.onPageHide ?? null
  onStop = opts.onStop ?? null
  if (onHide) window.addEventListener('pagehide', onHide)
  try { wake = await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { wake = null }
  emit()
}

export function stopCamLive() {
  if (!state) return
  state.host.stop()   // 트랙도 함께 정지
  state = null
  try { onStop?.() } catch { /* noop */ }
  onStop = null
  if (onHide) { window.removeEventListener('pagehide', onHide); onHide = null }
  wake?.release().catch(() => {}); wake = null
  emit()
}
