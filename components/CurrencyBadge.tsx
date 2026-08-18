// 두 가지 재화 표시 — 게임 코인(플레이용, 골드) vs 프롬프트 크레딧(스튜디오 생성용, 블루). 색·아이콘·이름으로 구분.
export function GameCoinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#f5b301" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="#c98a00" strokeWidth="1.6" />
      <path d="M12 7.5v9M9.6 10.2c0-1.2 1-1.9 2.4-1.9s2.4.7 2.4 1.7c0 2.4-4.8 1.4-4.8 3.9 0 1.1 1 1.9 2.4 1.9s2.4-.7 2.4-1.8" fill="none" stroke="#7a5200" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
export function PromptCreditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs><linearGradient id="pcg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
      <path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3-6.3-2.2 6.3-2.2L12 2.5Z" fill="url(#pcg)" />
      <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" fill="#06b6d4" />
    </svg>
  )
}
/** 게임 코인 배지 — 골드 */
export function GameCoinBadge({ amount, size = 'md', label = true }: { amount: number | null | undefined; size?: 'sm' | 'md'; label?: boolean }) {
  return (
    <span title="게임 코인 — 게임 플레이(코인 넣기)·AJ 광고 예산에 쓰는 코인" className={`inline-flex items-center gap-1.5 rounded-full border border-[#f2c94c]/70 bg-[#fff8e1] text-[#8a5a00] font-bold whitespace-nowrap ${size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'}`}>
      <GameCoinIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />{amount == null ? '—' : amount.toLocaleString()}{label && <span className="font-medium text-[#b07a1a] text-[11px]">게임 코인</span>}
    </span>
  )
}
/** 프롬프트 크레딧 배지 — 블루 */
export function PromptCreditBadge({ amount, size = 'md', label = true }: { amount: number | null | undefined; size?: 'sm' | 'md'; label?: boolean }) {
  return (
    <span title="프롬프트 크레딧 — 스튜디오에서 게임 생성·수정(1회 10)에 쓰는 크레딧" className={`inline-flex items-center gap-1.5 rounded-full border border-[#2563eb]/30 bg-[#eaf1ff] text-[#1e40af] font-bold whitespace-nowrap ${size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]'}`}>
      <PromptCreditIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />{amount == null ? '—' : amount.toLocaleString()}{label && <span className="font-medium text-[#3b6fd8] text-[11px]">프롬프트 크레딧</span>}
    </span>
  )
}
