'use client'
// 페이지 진입 시 항상 맨 위(프롬프트 섹션)부터 보이도록 — 모바일 하단 탭으로 홈에 돌아왔을 때
// 이전 스크롤/스냅 위치가 남는 문제 방지
import { useEffect } from 'react'

export default function ScrollTopOnMount() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 뒤로가기(bfcache/복원)는 건드리지 않고, 일반 진입만 위로
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'back_forward') return
    window.scrollTo({ top: 0, behavior: 'auto' })
    // 스냅/레이아웃이 늦게 잡히는 경우 한 번 더
    const t = setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 60)
    return () => clearTimeout(t)
  }, [])
  return null
}
