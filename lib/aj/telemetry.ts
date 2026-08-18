'use client'
// lib/aj/telemetry.ts — 플레이어(iframe 부모)에서 게임 세션을 기록한다.
// 게임 안 AJ.event(...) postMessage 를 받아 점수/게임오버/첫 게임오버 시각을 채우고, 15초마다·닫힐 때 저장.
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sess { id: string | null; startedAt: number; scoreMax: number | null; overs: number; firstOverSec: number | null; events: number }

export function useGameTelemetry(gameId: string, active: boolean) {
  const ref = useRef<Sess | null>(null)
  useEffect(() => {
    if (!active) return
    const supabase = createClient()
    const s: Sess = { id: null, startedAt: Date.now(), scoreMax: null, overs: 0, firstOverSec: null, events: 0 }
    ref.current = s
    let alive = true
    let userId: string | null = null
    const device = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'
    // 지도보드용 지오 핑 (로그인 여부 무관, 서버가 헤더에서만 위치를 읽는다)
    try { const cid = sessionStorage.getItem('ad_click'); if (cid) { fetch('/api/ads/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: cid, kind: 'play' }), keepalive: true }).catch(() => {}); sessionStorage.removeItem('ad_click') } } catch {}
    fetch('/api/geo/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'play', ref: gameId }), keepalive: true }).catch(() => {})

    const flush = async (final = false) => {
      if (!alive && !final) return
      if (!s.id || !userId) return
      const patch = {
        duration_sec: Math.round((Date.now() - s.startedAt) / 1000),
        score_max: s.scoreMax, game_overs: s.overs, first_over_sec: s.firstOverSec, events: s.events,
        ended_at: final ? new Date().toISOString() : null,
      }
      try {
        if (final && typeof navigator.sendBeacon === 'function') {
          // 닫힐 때는 beacon 으로 (페이지 이탈에도 살아남게) — REST PATCH
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token
          if (token) {
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/game_sessions?id=eq.${s.id}`
            fetch(url, { method: 'PATCH', keepalive: true, headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(patch) }).catch(() => {})
            return
          }
        }
        await supabase.from('game_sessions').update(patch as never).eq('id', s.id)
      } catch { /* ignore */ }
    }

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !alive) return
      userId = user.id
      const { data } = await supabase.from('game_sessions').insert([{ game_id: gameId, user_id: user.id, device }] as never).select('id').maybeSingle()
      if (data && alive) s.id = (data as { id: string }).id
    })()

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; name?: string; data?: { score?: number; level?: unknown } | null; t?: number } | null
      if (!d || d.type !== 'aj:event') return
      s.events++
      const sec = Math.round((Date.now() - s.startedAt) / 1000)
      if (d.name === 'score' && typeof d.data?.score === 'number') s.scoreMax = Math.max(s.scoreMax ?? 0, d.data.score)
      if (d.name === 'over') {
        s.overs++
        if (typeof d.data?.score === 'number') s.scoreMax = Math.max(s.scoreMax ?? 0, d.data.score)
        if (s.firstOverSec == null) s.firstOverSec = sec
      }
    }
    window.addEventListener('message', onMsg)
    const iv = setInterval(() => flush(false), 15000)
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true) }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      alive = false
      window.removeEventListener('message', onMsg)
      document.removeEventListener('visibilitychange', onHide)
      clearInterval(iv)
      flush(true)
    }
  }, [gameId, active])
}
