'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// 네이티브 앱 전용 브리지 — 하단 탭바(App.tsx)가 웹을 조종할 수 있게 연결한다.
// 1) window.__vibexNav(path): 네이티브 탭 터치 → Next 클라이언트 라우팅(새로고침 없이 이동)
// 2) 현재 경로를 네이티브로 보고 → 탭바 활성 상태 갱신 / 특정 화면에서 탭바 숨김
export default function NativeBridge() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof navigator === 'undefined' || !/VibrexcupApp/i.test(navigator.userAgent)) return
    const w = window as unknown as { __vibexNav?: (p: string) => void }
    w.__vibexNav = (path: string) => { try { router.push(path) } catch { /* noop */ } }
    // 앱에서는 노치·홈바 영역까지 웹뷰가 차지할 수 있게(viewport-fit=cover) → 게임 플레이 시 env(safe-area-inset-*) 로 여백 계산
    try {
      const m = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
      if (m && !/viewport-fit/.test(m.content)) m.content = `${m.content}, viewport-fit=cover`
    } catch { /* noop */ }
    return () => { delete w.__vibexNav }
  }, [router])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !/VibrexcupApp/i.test(navigator.userAgent)) return
    const w = window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }
    // 관리자·스튜디오·게임 플레이·인증 화면에서는 탭바 숨김(몰입/공간 확보)
    const hide = /^\/(admin|studio|play|login|signup|forgot-password|reset-password|auth)(\/|$)/.test(pathname)
    w.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'route', path: pathname, hideTabBar: hide }))
  }, [pathname])

  return null
}
