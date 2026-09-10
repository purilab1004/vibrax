// 로딩 마스코트 — 점토 캐릭터가 통통 튀며 윙크한다. (윙크 = 이동/불러오는 중 신호)
// 라우트 전환(app/loading.tsx)과 컴포넌트 Suspense fallback 에서 공용으로 쓴다.
export default function MascotLoader({ size = 76, className = 'min-h-[55vh] py-20' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="vbx-load">
        <svg viewBox="0 0 32 32" width={size} height={size} aria-label="불러오는 중" role="img">
          <rect x="8.6" y="8.6" width="17" height="17" rx="5" fill="#b93d16" transform="rotate(-3 17 17)" />
          <rect x="7" y="7" width="17" height="17" rx="5" fill="#F05A28" transform="rotate(-3 15.5 15.5)" />
          <rect x="7" y="7" width="17" height="8" rx="5" fill="#ff8a5c" opacity="0.65" transform="rotate(-3 15.5 15.5)" />
          <circle className="vbx-eye-open" cx="12.6" cy="15.4" r="1.5" fill="#161616" />
          <path className="vbx-eye-wink" d="M10.9 15.5q1.7 1.4 3.4 0" stroke="#161616" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <circle cx="18.8" cy="15.1" r="1.5" fill="#161616" />
          <path d="M13.9 19.2q1.8 1.6 3.6 0" stroke="#161616" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  )
}
