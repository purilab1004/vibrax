// 로고 마크 — 파란 배지 + 찰흙 큐브 캐릭터 (카드 캐릭터와 동일 모티프)
export default function LogoMark({ className = 'w-7 h-7 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="#7dd3fc" />
      {/* 뒤판 — 3D 두께 */}
      <rect x="8.6" y="8.6" width="17" height="17" rx="5" fill="#b93d16" transform="rotate(-3 17 17)" />
      {/* 앞판 — 클레이 오렌지 */}
      <rect x="7" y="7" width="17" height="17" rx="5" fill="#F05A28" transform="rotate(-3 15.5 15.5)" />
      {/* 상단 밝은 면 */}
      <rect x="7" y="7" width="17" height="8" rx="5" fill="#ff8a5c" opacity="0.65" transform="rotate(-3 15.5 15.5)" />
      {/* 눈 + 미소 */}
      <circle cx="12.6" cy="15.4" r="1.5" fill="#161616" />
      <circle cx="18.8" cy="15.1" r="1.5" fill="#161616" />
      <path d="M13.9 19.2q1.8 1.6 3.6 0" stroke="#161616" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  )
}
