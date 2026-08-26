'use client'
// 서비스워커 등록 — 프로덕션에서만. PWA 설치 프롬프트/오프라인 지원.
import { useEffect } from 'react'
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (location.hostname === 'localhost') return
    const t = setTimeout(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }, 1200)
    return () => clearTimeout(t)
  }, [])
  return null
}
