'use client'

import { usePathname } from 'next/navigation'
import FooterLinks from '@/components/FooterLinks'

// 사이트 푸터 — 스튜디오(작업 공간)에서는 숨긴다
export default function SiteFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/studio')) return null
  // /games(쇼츠 피드)에서는 모바일 푸터를 숨긴다 — 데스크톱만 표시
  const mobileHidden = pathname === '/games'
  return (
    <footer className={`${mobileHidden ? 'hidden md:block' : ''} border-t border-[#ebe4d6] py-6 px-6 pb-20 md:pb-6 mt-auto md:pl-[var(--rail-w,0rem)] transition-[padding] duration-200`}>
      <FooterLinks />
    </footer>
  )
}
