'use client'
// 마운트 동안 <html> 에 클래스를 붙인다 — 페이지별 전역 CSS 훅 (예: 앱에서 /games 피드는 상단 safe-area 여백을 두지 않고 카드가 카메라 뒤까지 채움)
import { useEffect } from 'react'

export default function HtmlClass({ name }: { name: string }) {
  useEffect(() => {
    document.documentElement.classList.add(name)
    return () => document.documentElement.classList.remove(name)
  }, [name])
  return null
}
