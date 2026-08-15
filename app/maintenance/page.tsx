// 점검 안내 — IP 허용 목록 외 방문자에게 표시 (proxy.ts에서 rewrite)
export const metadata = {
  title: '점검 중 — Vibrexcup',
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#fcfaf5] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* 잠자는 점토이 */}
        <svg viewBox="0 0 200 160" className="w-52 mx-auto mb-8" aria-hidden>
          <ellipse cx="100" cy="140" rx="56" ry="8" fill="#000" opacity="0.1" />
          <rect x="66" y="40" width="80" height="80" rx="20" fill="#b93d16" transform="rotate(-3 111 85)" />
          <rect x="60" y="34" width="80" height="80" rx="20" fill="#F05A28" transform="rotate(-3 100 74)" />
          <rect x="60" y="34" width="80" height="36" rx="20" fill="#ff8a5c" opacity="0.6" transform="rotate(-3 100 74)" />
          {/* 잠든 눈 */}
          <g stroke="#161616" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M78 70q7 5 14 0" />
            <path d="M108 70q7 5 14 0" />
          </g>
          {/* 자는 입 */}
          <ellipse cx="100" cy="88" rx="5" ry="6" fill="#161616" />
          {/* Zzz */}
          <text x="145" y="40" fontSize="20" fill="#9d9280" fontWeight="bold">z</text>
          <text x="158" y="28" fontSize="15" fill="#b3a78f" fontWeight="bold">z</text>
          <text x="168" y="19" fontSize="11" fill="#cfc4ab" fontWeight="bold">z</text>
        </svg>

        <h1 className="text-2xl md:text-3xl font-extrabold text-[#241f17] mb-4">
          현재 점검 중입니다
        </h1>
        <p className="text-[#6b6152] text-sm md:text-base leading-relaxed mb-8">
          더 나은 서비스를 위해 잠시 정비하고 있어요.<br />
          점토이가 기지개를 켜면 곧 돌아옵니다!
        </p>
        <p className="font-pixel text-[11px] text-[#9d9280] tracking-[0.3em]">
          VIBREXCUP · UNDER MAINTENANCE
        </p>
      </div>
    </div>
  )
}
