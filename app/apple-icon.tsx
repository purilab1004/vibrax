import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <svg viewBox="0 0 32 32" width="180" height="180">
          <rect x="0" y="0" width="32" height="32" fill="#7dd3fc" />
          <rect x="8.6" y="8.6" width="17" height="17" rx="5" fill="#b93d16" transform="rotate(-3 17 17)" />
          <rect x="7" y="7" width="17" height="17" rx="5" fill="#F05A28" transform="rotate(-3 15.5 15.5)" />
          <rect x="7" y="7" width="17" height="8" rx="5" fill="#ff8a5c" opacity="0.65" transform="rotate(-3 15.5 15.5)" />
          <circle cx="12.6" cy="15.4" r="1.5" fill="#161616" />
          <circle cx="18.8" cy="15.1" r="1.5" fill="#161616" />
          <path d="M13.9 19.2q1.8 1.6 3.6 0" stroke="#161616" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
