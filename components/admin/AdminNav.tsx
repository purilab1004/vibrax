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
    ['/admin/settings', a.navSettings],
  ]
  const active = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  return (
    <aside className="md:w-48 shrink-0">
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`font-pixel text-[10px] tracking-widest px-4 py-3 border transition-colors whitespace-nowrap ${
              active(href)
                ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/5'
                : 'border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
