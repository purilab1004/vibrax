'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const n = T.notices

  useEffect(() => {
    supabase.from('notices').select('*')
      .eq('published', true)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{n.heading}</h1>
      {notices === null ? null : notices.length === 0 ? (
        <p className="text-gray-500 text-sm">{n.empty}</p>
      ) : (
        <div className="border border-gray-800 divide-y divide-gray-800">
          {notices.map(item => (
            <Link key={item.id} href={`/notices/${item.id}`} className="flex items-center gap-3 px-5 py-4 bg-[#111] hover:bg-[#161616] transition-colors group">
              {item.pinned && (
                <span className="font-pixel text-[10px] text-[#00ff41] border border-[#00ff41] px-1.5 py-0.5 shrink-0">{n.pinned}</span>
              )}
              <span className="text-sm text-white group-hover:text-[#00ff41] transition-colors truncate flex-1">{item.title}</span>
              <span className="text-[11px] text-gray-600 shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
