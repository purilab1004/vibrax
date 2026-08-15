import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// 해변 로고 마크 — 파란 하늘 배지 + 모래 언덕 + 야자수 (NavBar LogoMark와 동일)
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <svg viewBox="0 0 32 32" width="32" height="32">
          <rect x="0" y="0" width="32" height="32" rx="8" fill="#2563eb" />
          <path d="M0 25c6-3.5 14-4.5 20-3.5s9 2 12 3.5v7H0Z" fill="#f3e3b8" />
          <path d="M15.5 24.5c.4-4.5 1.2-8.5 3.2-11.5" stroke="#8a5a2b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <g fill="none" stroke="#39b36b" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18.7 13c-3.2-2.2-6.4-2.4-9-1" />
            <path d="M18.7 13c-1-3.4-3-5.6-5.6-6.6" />
            <path d="M18.7 13c1.4-3.2 3.8-5 6.6-5.4" />
            <path d="M18.7 13c3.4-1.4 6.6-.8 8.8 1" />
            <path d="M18.7 13c2.6.6 4.6 2.4 5.6 5" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
