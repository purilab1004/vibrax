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
    document.documentElement.classList.add('vbx-app') // 앱 표시 클래스 — 로드 전 주입분은 하이드레이션 때 지워질 수 있어 여기서도 붙인다
    const w = window as unknown as { __vibexNav?: (p: string) => void }
    // 같은 탭을 다시 누르면(예: 홈에서 홈) 맨 위(프롬프트 섹션)로 — 다른 경로면 이동 후 맨 위부터
    w.__vibexNav = (path: string) => {
      try {
        if (window.location.pathname === path.split('?')[0]) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
        router.push(path)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 50)
      } catch { /* noop */ }
    }
    // 앱에서는 노치·홈바 영역까지 웹뷰가 차지할 수 있게(viewport-fit=cover) → 게임 플레이 시 env(safe-area-inset-*) 로 여백 계산
    try {
      const m = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
      if (m && !/viewport-fit/.test(m.content)) m.content = `${m.content}, viewport-fit=cover`
    } catch { /* noop */ }
    // 앱(새 빌드)이 주입한 실측 safe-area → CSS 변수(--app-top/--app-bottom). 구 빌드는 0 → env() 만 사용
    try {
      const ins = (window as unknown as { VIBREX_INSETS?: { top?: number; bottom?: number } }).VIBREX_INSETS
      document.documentElement.style.setProperty('--app-top', `${ins?.top ?? 0}px`)
      document.documentElement.style.setProperty('--app-bottom', `${ins?.bottom ?? 0}px`)
    } catch { /* noop */ }
    // 탭 화면 미리 받기 — 앱 하단 탭을 눌렀을 때 마스코트 로더 없이 바로 전환되게
    const idle = (cb: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 2500 }) : window.setTimeout(cb, 800))
    idle(() => { for (const p of ['/', '/games', '/studio', '/tournament', '/profile']) { try { router.prefetch(p) } catch { /* noop */ } } })
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
