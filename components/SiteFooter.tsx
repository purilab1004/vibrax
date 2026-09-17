'use client'

import { usePathname } from 'next/navigation'
import FooterLinks from '@/components/FooterLinks'

// 사이트 푸터 — 스튜디오(작업 공간)에서는 숨긴다
export default function SiteFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/studio')) return null
  // 홈은 페이지 푸터 대신 피드 좌측 사이드 메뉴 하단에 축약 푸터를 둔다
  if (pathname === '/') return null
  if (pathname === '/games') return null   // 게임 피드(PC) — 한 장씩 넘기는 화면에서 푸터가 방해됨 (링크는 좌측 사이드 메뉴 하단에 있음)
  // 관리자는 사이드바 하단 축약 푸터로 대체
  if (pathname.startsWith('/admin')) return null
  if (pathname.startsWith('/profile')) return null   // 내정보 — 사이드바 메뉴 화면이라 푸터 불필요
  // 모바일에서는 푸터를 전부 숨긴다(하단 앱 내비가 있어 불필요) — 데스크톱만 표시
  return (
    <footer className="hidden md:block border-t border-[#ebe4d6] py-6 px-6 mt-auto md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200">
      <FooterLinks />
    </footer>
  )
}
