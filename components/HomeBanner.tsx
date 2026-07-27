'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { BannerSetting } from '@/lib/supabase/types'

export default function HomeBanner() {
  const [banner, setBanner] = useState<BannerSetting | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'banner').maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: BannerSetting } | null)?.value
        if (v?.enabled && v.text) setBanner(v)
      })
  }, [])

  if (!banner) return null
  const inner = (
    <p className="max-w-7xl mx-auto px-6 py-2.5 text-center text-xs text-black font-pixel tracking-widest truncate">
      📢 {banner.text}
    </p>
  )
  return banner.link
    ? <Link href={banner.link} className="block bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors">{inner}</Link>
    : <div className="bg-[#2563eb]">{inner}</div>
}
