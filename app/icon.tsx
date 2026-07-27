import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// 해변 로고 마크 — 파란 바다 배지 + 햇살 + 흰 파도 (NavBar LogoMark와 동일 모티프)
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#2563eb',
          borderRadius: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 태양 */}
        <div
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 9,
            height: 9,
            borderRadius: 9,
            background: '#ffd34d',
          }}
        />
        {/* 파도 두 겹 */}
        <div
          style={{
            position: 'absolute',
            left: -6,
            bottom: -14,
            width: 24,
            height: 24,
            borderRadius: 24,
            background: '#ffffff',
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -6,
            bottom: -17,
            width: 26,
            height: 26,
            borderRadius: 26,
            background: '#fcfaf5',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
