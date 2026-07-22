'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

export default function FooterLinks() {
  const { T } = useLang()
  const f = T.footer
  const links: [string, string][] = [
    ['/terms', f.terms],
    ['/privacy', f.privacy],
    ['/refund', f.refund],
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      <nav className="flex items-center gap-4 flex-wrap justify-center">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="text-[11px] text-gray-500 hover:text-[#00ff41] transition-colors"
          >
            {label}
          </Link>
        ))}
        <a
          href="mailto:dev@puritechlab.com"
          className="text-[11px] text-gray-500 hover:text-[#00ff41] transition-colors"
        >
          dev@puritechlab.com
        </a>
      </nav>
      <p className="text-center font-pixel text-[9px] text-gray-500 tracking-widest">
        {f.copyright}
      </p>
    </div>
  )
}
