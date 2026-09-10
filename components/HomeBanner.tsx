'use client'
// 홈 상단 배너 — 관리자 설정(site_settings.banner)으로 켜고 끈다.
// style 'promo': 다크 바 + 마스코트 + 강조 문구 + 코드 칩 + 노란 CTA + 닫기(X, 버전별 기억)
// style 'simple': 예전 파란 한 줄 공지
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BannerSetting } from '@/lib/supabase/types'

const DISMISS_KEY = 'vx_banner_dismissed'

export default function HomeBanner() {
  const [banner, setBanner] = useState<BannerSetting | null>(null)
  const [closed, setClosed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('site_settings').select('value').eq('key', 'banner').maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: BannerSetting } | null)?.value
        if (!v?.enabled || !v.text) return
        try { if (v.dismissible && localStorage.getItem(DISMISS_KEY) === String(v.version ?? '')) { setClosed(true) } } catch { /* ignore */ }
        setBanner(v)
      })
  }, [])

  if (pathname !== '/' || !banner || closed) return null
  const dismiss = () => { setClosed(true); try { localStorage.setItem(DISMISS_KEY, String(banner.version ?? '')) } catch { /* ignore */ } }
  const isExternal = /^https?:\/\//.test(banner.link ?? '')

  if ((banner.style ?? 'simple') === 'simple') {
    const inner = (
      <p className="max-w-7xl mx-auto px-6 py-2.5 text-center text-xs text-black font-pixel tracking-widest truncate">📢 {banner.text}</p>
    )
    return banner.link
      ? <Link href={banner.link} className="block bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors">{inner}</Link>
      : <div className="bg-[#2563eb]">{inner}</div>
  }

  // promo — 문장 안의 {highlight} 자리에 강조 문구, {code} 자리에 코드 칩. 없으면 뒤에 붙인다.
  const parts = banner.text.split(/(\{highlight\}|\{code\})/)
  const hasSlots = parts.length > 1
  const highlight = banner.highlight?.trim()
  const code = banner.code?.trim()
  const CTA = banner.cta?.trim() && banner.link
    ? (isExternal
      ? <a href={banner.link} target="_blank" rel="noopener" className="shrink-0 inline-flex items-center h-8 px-3.5 rounded-lg bg-[#ffd21e] text-[#241f17] text-[12.5px] font-extrabold hover:bg-[#ffdf5a] transition-colors">{banner.cta}</a>
      : <Link href={banner.link} className="shrink-0 inline-flex items-center h-8 px-3.5 rounded-lg bg-[#ffd21e] text-[#241f17] text-[12.5px] font-extrabold hover:bg-[#ffdf5a] transition-colors">{banner.cta}</Link>)
    : null
  return (
    <div className="relative overflow-hidden bg-[#0f1220] text-white" role="region" aria-label="promotion">
      {/* 배경 — 어두운 그라디언트 + 글로우 */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_140%_at_50%_0%,rgba(37,99,235,0.35),transparent_60%),radial-gradient(40%_120%_at_10%_50%,rgba(240,90,40,0.25),transparent_60%),radial-gradient(40%_120%_at_90%_50%,rgba(124,58,237,0.3),transparent_60%)]" />
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 h-11 md:h-12 flex items-center justify-center gap-3 md:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/aibot.png" alt="" className="hidden sm:block w-7 h-7 object-contain drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
        <p className="min-w-0 truncate text-[12.5px] md:text-[13.5px] font-semibold tracking-tight">
          {hasSlots
            ? parts.map((p, i) => p === '{highlight}' ? <span key={i} className="text-[#7dd3fc]">{highlight}</span> : p === '{code}' ? <span key={i} className="text-[#7dd3fc] font-extrabold">{code}</span> : <span key={i}>{p}</span>)
            : <>{banner.text}{highlight && <span className="text-[#7dd3fc]"> {highlight}</span>}{code && <> · <span className="text-white/70">{'코드'}:</span> <span className="text-[#7dd3fc] font-extrabold">{code}</span></>}</>}
        </p>
        {CTA}
        {banner.dismissible && (
          <button onClick={dismiss} aria-label="닫기" className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center text-[15px]">×</button>
        )}
      </div>
    </div>
  )
}
