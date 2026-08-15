'use client'

import { useState } from 'react'

// 게임 공유 — 모바일은 시스템 공유 시트, 데스크톱은 링크 복사
export default function ShareButton({ title }: { title?: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: title ?? 'Vibrexcup', url })
        return
      } catch { /* 사용자가 취소 — 복사로 폴백하지 않음 */ return }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      onClick={share}
      className="shrink-0 flex items-center justify-center gap-2 rounded-full font-pixel text-[12px] bg-[#ec4899] text-white px-8 hover:bg-[#db2777] transition-colors whitespace-nowrap tracking-widest shadow-[0_4px_0_#9d1c5e,0_8px_16px_rgba(236,72,153,0.35)] active:translate-y-1 active:shadow-[0_1px_0_#9d1c5e]"
      title="게임 공유"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? '✓ 복사됨' : '공유'}
    </button>
  )
}
