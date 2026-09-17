'use client'
// 카메라 방송이 켜진 채 다른 페이지에 있을 때 — 작은 ON AIR 알림(누르면 방송 관리로). 게임 플레이 화면(z-70) 아래에 깔려 게임 중엔 가려진다
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getCamLive, subscribeCamLive } from '@/lib/live/camLive'

export default function CamLiveDock() {
  const live = useSyncExternalStore(subscribeCamLive, () => !!getCamLive(), () => false)
  const pathname = usePathname()
  if (!live || pathname.startsWith('/broadcast')) return null
  return (
    <Link href="/broadcast" className="fixed left-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-[65] flex items-center gap-1.5 rounded-full bg-[#e11d48] text-white text-[12px] font-bold px-3 py-1.5 shadow-[0_6px_18px_rgba(225,29,72,0.45)]">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> 카메라 방송 중 · 관리
    </Link>
  )
}
