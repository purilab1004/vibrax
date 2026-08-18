'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/context'

export default function AdminNav() {
  const pathname = usePathname()
  const { T } = useLang()
  const a = T.admin
  const items: [string, string][] = [
    ['/admin', a.navDashboard],
    ['/admin/games', a.navGames],
    ['/admin/blog', a.navBlog],
    ['/admin/notices', a.navNotices],
    ['/admin/members', a.navMembers],
    ['/admin/applications', a.navApplications],
    ['/admin/aj', 'AJ 랭킹'],
    ['/admin/map', '지도보드'],
    ['/admin/payments', '결제 관리'],
    ['/admin/costs', 'LLM 원가'],
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
          className={`text-[12.5px] font-semibold px-3.5 h-9 inline-flex items-center rounded-full whitespace-nowrap transition-colors ${
            active(href) ? 'bg-[#241f17] text-white' : 'bg-white border border-[#ebe4d6] text-[#6b6152] hover:border-[#cfc4ab] hover:text-[#241f17]'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
