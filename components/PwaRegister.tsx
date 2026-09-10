'use client'
// 서비스워커 등록 — 프로덕션에서만. PWA 설치 프롬프트/오프라인 지원.
import { useEffect } from 'react'
export default function PwaRegister() {
  // iOS 감지 — iOS WebView/Safari 는 문서 스냅 스크롤이 무겁게 느껴져, .vbx-ios 로 스냅을 부드럽게 완화한다(globals.css)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua) || /\(ios\)/i.test(ua) ||
      (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ? (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1 : false)
    if (isIOS) document.documentElement.classList.add('vbx-ios')
  }, [])
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (location.hostname === 'localhost') return
    const t = setTimeout(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }, 1200)
    return () => clearTimeout(t)
  }, [])
  return null
}
