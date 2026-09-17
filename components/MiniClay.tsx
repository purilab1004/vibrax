// 점토 캐릭터(작은 네모 얼굴) — About 페이지와 갤러리 히어로에서 같이 쓴다
export default function MiniClay({ color }: { color: string }) {
  const dark = `#${(Math.max(0, parseInt(color.slice(1), 16) - 0x2a2a2a)).toString(16).padStart(6, '0')}`
  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" aria-hidden>
      <rect x="22" y="22" width="60" height="60" rx="16" fill={dark} transform="rotate(-3 54 54)" opacity="0.85" />
      <rect x="18" y="18" width="60" height="60" rx="16" fill={color} transform="rotate(-3 48 48)" />
      <circle cx="40" cy="45" r="2.8" fill="#161616" />
      <circle cx="58" cy="45" r="2.8" fill="#161616" />
      <path d="M44 54q5 4 10 0" stroke="#161616" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
