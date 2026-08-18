'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

export default function AdminNav() {
  const pathname = usePathname()
  const { T } = useLang()
  const a = T.admin
  const items: [string, string][] = [
    ['/admin/map', '지도보드'],
    ['/admin', a.navDashboard],
    ['/admin/games', a.navGames],
    ['/admin/blog', a.navBlog],
    ['/admin/notices', a.navNotices],
    ['/admin/members', a.navMembers],
    ['/admin/applications', a.navApplications],
    ['/admin/aj', 'AJ 랭킹'],
    ['/admin/ads', 'AJ AdPilot'],
    ['/admin/payments', '결제 관리'],
    ['/admin/costs', 'TokenPilot'],
    ['/admin/access', '접속 관리'],
    ['/admin/logs', '에러 로그'],
    ['/admin/settings', a.navSettings],
  ]
  const active = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  return (
    <nav className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`text-[12px] font-semibold px-3 h-8 inline-flex items-center rounded-md whitespace-nowrap transition-colors ${
            active(href) ? 'bg-[#2563eb] text-white' : 'bg-white border border-[#d9dde5] text-[#6b7280] hover:text-[#1f2430]'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
