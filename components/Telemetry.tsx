'use client'
// 접속(페이지 뷰) + 클라이언트 에러 수집 — 레이아웃에 1회 마운트. 관리자 /admin/access, /admin/logs 에서 확인.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const sid = () => { try { let s = sessionStorage.getItem('vx_sid'); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('vx_sid', s) } return s } catch { return null } }
const post = (url: string, body: unknown) => { try { const blob = new Blob([JSON.stringify(body)], { type: 'application/json' }); if (!navigator.sendBeacon?.(url, blob)) fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {}) } catch {} }

export default function Telemetry() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    post('/api/log/visit', { path: pathname, referrer: document.referrer || null, sid: sid() })
  }, [pathname])
  useEffect(() => {
    const seen = new Map<string, number>()
    const report = (message: string, stack?: string, level: 'error' | 'warn' = 'error') => {
      const key = message.slice(0, 120); const now = Date.now()
      if ((seen.get(key) ?? 0) > now - 30_000) return  // 같은 에러 30초 내 중복 제거
      seen.set(key, now)
      post('/api/log/error', { message, stack, path: location.pathname, level })
    }
    const onErr = (e: ErrorEvent) => { if (e.message && !/ResizeObserver loop|Script error\.?$/.test(e.message)) report(e.message, e.error?.stack) }
    const onRej = (e: PromiseRejectionEvent) => { const r = e.reason; report(r instanceof Error ? r.message : String(r ?? 'unhandledrejection'), r instanceof Error ? r.stack : undefined) }
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onRej)
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])
  return null
}
