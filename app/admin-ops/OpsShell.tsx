'use client'
import { useEffect } from 'react'
export default function OpsShell({ children }: { children: React.ReactNode }) {
  // 전역 레일 여백 제거 — 이 화면은 단독으로 꽉 차게
  useEffect(() => { const el = document.documentElement; const prev = el.style.getPropertyValue('--rail-w'); el.style.setProperty('--rail-w', '0rem'); return () => { el.style.setProperty('--rail-w', prev) } }, [])
  return <div className="admin-ui min-h-[100svh] bg-[#f4f5f8] text-[#1f2430]">{children}</div>
}
