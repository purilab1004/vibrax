'use client'
// 데스크톱 피드 카드의 우측 레일(게임 카드와 같은 틀) — 관리자 카드(잭팟·끝 카드)용: 점토 아이콘 프로필 + 통계 + 공유
import { useState } from 'react'
import MiniClay from '@/components/MiniClay'

export default function CardRail({ name = 'VIBREXCUP', color = '#5AB0F2', stats = [], shareUrl }: { name?: string; color?: string; stats?: { icon: React.ReactNode; label: string }[]; shareUrl?: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => { try { await navigator.clipboard.writeText(shareUrl ?? window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* noop */ } }
  return (
    <div className="flex flex-col items-center gap-5 self-end pb-8">
      <div className="flex flex-col items-center gap-1.5" title={name}>
        <span className="avatar-ring shadow-[0_2px_10px_rgba(36,31,23,0.15)]"><span className="avatar-wave w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-white">
          <span className="w-10 h-10 avatar-bob"><MiniClay color={color} /></span>
        </span></span>
        <span className="text-[11px] font-semibold text-[#6b6152] max-w-[72px] truncate">{name}</span>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 text-[#6b6152]">
          <span className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center">{s.icon}</span>
          <span className="text-[11px] font-bold">{s.label}</span>
        </div>
      ))}
      <div className="flex flex-col items-center gap-0.5 text-[#6b6152]">
        <button onClick={share} title="링크 복사" className="w-12 h-12 rounded-full bg-white border border-[#ebe4d6] shadow-[0_2px_10px_rgba(36,31,23,0.1)] flex items-center justify-center hover:border-[#ec4899] hover:text-[#ec4899] transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        </button>
        <span className="text-[11px] font-bold">{copied ? '복사됨!' : '공유'}</span>
      </div>
    </div>
  )
}
