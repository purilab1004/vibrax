// 싱글/멀티 플레이 라벨 — 아이콘 + 짧은 글자. 쇼츠 카드·게임 페이지·목록에서 공통으로 쓴다
export type PlayMode = 'single' | 'multi'
export const PLAY_MODE_LABEL: Record<PlayMode, string> = { single: '싱글', multi: '멀티' }
export function PlayModeIcon({ mode, className = 'w-3.5 h-3.5' }: { mode: PlayMode; className?: string }) {
  return mode === 'multi' ? (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="9" cy="8" r="3.2" /><path d="M2.8 19c.6-3.3 3-5 6.2-5s5.6 1.7 6.2 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.2c3 .2 5 1.8 5.6 4.8" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.6-6 7.5-6s6.7 2 7.5 6" /></svg>
  )
}
export default function PlayModeBadge({ mode, dark = true, className = '' }: { mode?: string | null; dark?: boolean; className?: string }) {
  const m: PlayMode = mode === 'multi' ? 'multi' : 'single'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold tracking-wide ${m === 'multi' ? (dark ? 'bg-[#7c3aed]/85 text-white' : 'bg-[#7c3aed]/10 text-[#6d28d9] border border-[#7c3aed]/30') : (dark ? 'bg-black/45 text-white backdrop-blur' : 'bg-[#f1ece2] text-[#4a4337] border border-[#ddd3bf]')} ${className}`} title={m === 'multi' ? '멀티플레이 — 여러 명이 함께' : '싱글플레이 — 혼자'}>
      <PlayModeIcon mode={m} />{PLAY_MODE_LABEL[m]}
    </span>
  )
}
