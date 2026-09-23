'use client'
// 서비스워커 등록 — 프로덕션에서만. PWA 설치 프롬프트/오프라인 지원.
import { useEffect } from 'react'
export default function PwaRegister() {
  // iOS 감지 — .vbx-ios 로 iOS 전용 스크롤 규칙(globals.css: 한 장씩 mandatory 스냅 + 터치 스크롤)을 적용한다
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
