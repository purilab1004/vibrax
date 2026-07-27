'use client'

import { linePoints } from '@/lib/admin/chart'

const W = 300
const H = 80

export default function TrendChart({ label, sub, values, color = '#0284c7' }: {
  label: string
  sub: string
  values: number[]
  color?: string
}) {
  const points = linePoints(values, W, H, 4)
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div className="border border-[#ebe4d6] bg-[#ffffff] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-pixel text-[11px] text-[#857a68] tracking-widest">{label}</p>
        <p className="font-pixel text-[11px] text-[#9d9280]">{sub} · {total.toLocaleString()}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        {points && (
          <>
            <polyline points={`4,${H - 4} ${points} ${W - 4},${H - 4}`} fill={color} opacity={0.08} stroke="none" />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
          </>
        )}
      </svg>
    </div>
  )
}
