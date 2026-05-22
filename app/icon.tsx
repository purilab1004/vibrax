import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0a0a0a',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Green accent border */}
      <div
        style={{
          position: 'absolute',
          inset: 2,
          border: '1.5px solid #00ff41',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#00ff41',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'monospace',
            lineHeight: 1,
          }}
        >
          V
        </span>
      </div>
    </div>,
    { ...size }
  )
}
