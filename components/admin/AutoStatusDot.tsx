'use client'
// 메뉴 옆 자동화 상태등 — 초록 깜빡임(AI on·정상) / 회색(off) / 빨강(오류 — 해당 메뉴에서 초기화)
import { useEffect, useState } from 'react'
export function useAutoHealth() {
  const [h, setH] = useState<{ health: Record<string, { state: 'on' | 'off' | 'error'; errors: number; review: number }>; menuModule: Record<string, string> } | null>(null)
  useEffect(() => { let alive = true; const go = () => fetch('/api/admin/automation').then(r => r.ok ? r.json() : null).then(j => { if (alive && j) setH(j) }).catch(() => {}); go(); const iv = setInterval(go, 60_000); return () => { alive = false; clearInterval(iv) } }, [])
  return h
}
export function AutoDot({ state, size = 8 }: { state?: 'on' | 'off' | 'error'; size?: number }) {
  if (!state) return null
  const cls = state === 'on' ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)] animate-pulse' : state === 'error' ? 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.3)]' : 'bg-white/25'
  return <span aria-label={state === 'on' ? 'AI 자동 처리 중' : state === 'error' ? 'AI 처리 오류' : 'AI 꺼짐'} className={`inline-block rounded-full shrink-0 ${cls}`} style={{ width: size, height: size }} />
}
