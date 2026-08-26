'use client'
// 네이티브 앱(WebView) 안에서 실행 중인지 — App.tsx 가 userAgent 에 'VibrexcupApp' 을 붙인다.
// 앱 스토어 정책상 디지털 재화(프롬코인) 구매는 앱 안에서 노출하면 안 되므로, 이걸로 구매 UI 를 숨긴다.
import { useEffect, useState } from 'react'
export function isNativeAppUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /VibrexcupApp/i.test(navigator.userAgent)
}
export function useIsNativeApp(): boolean {
  const [v, setV] = useState(false)
  useEffect(() => { setV(isNativeAppUA()) }, [])
  return v
}
