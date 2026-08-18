'use client'
// 추이 차트 — 그라디언트 영역 + 호버 툴팁 (외부 라이브러리 없음)
import { useId, useState } from 'react'

const W = 320
const H = 96
const PAD = 6

export default function TrendChart({ label, sub, values, labels, color = '#2563eb', format = (v: number) => v.toLocaleString() }: {
  label: string
  sub?: string
  values: number[]
  labels?: string[]
  color?: string
  format?: (v: number) => string
}) {
  const gid = useId()
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  const max = Math.max(...values, 1)
  const stepX = n > 1 ? (W - PAD * 2) / (n - 1) : 0
  const pts = values.map((v, i) => [PAD + i * stepX, H - PAD - (v / max) * (H - PAD * 2)] as const)
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = n ? `${PAD},${H - PAD} ${line} ${(PAD + (n - 1) * stepX).toFixed(1)},${H - PAD}` : ''
  const total = values.reduce((a, b) => a + b, 0)
  const last7 = values.slice(-7).reduce((a, b) => a + b, 0)
  const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0)
  const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0
  const hv = hover != null ? values[hover] : null

  return (
    <div className="rounded-lg border border-[#e3e6ec] bg-white px-4 py-3">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
          <p className="text-[20px] font-bold tracking-tight text-[#1f2430] mt-0.5">{hv != null ? format(hv) : format(total)}<span className="text-[11px] font-medium text-[#9aa1ad] ml-1.5">{hv != null && labels?.[hover!] ? labels[hover!] : sub}</span></p>
        </div>
        {n >= 14 && last7 + prev7 >= 5 && (
          <span className={`text-[11.5px] font-semibold rounded-full px-2 py-0.5 ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% <span className="font-normal opacity-70">7일</span></span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 overflow-visible" preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round((x - PAD) / (stepX || 1))))) }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => <line key={f} x1={PAD} x2={W - PAD} y1={PAD + (H - PAD * 2) * f} y2={PAD + (H - PAD * 2) * f} stroke="#241f17" strokeOpacity={0.05} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {n > 0 && <polygon points={area} fill={`url(#${gid})`} />}
        {n > 0 && <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {hover != null && pts[hover] && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD} y2={H - PAD} stroke={color} strokeOpacity={0.35} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={4} fill="#fff" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  )
}
