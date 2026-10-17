'use client'
// Vibrex 로딩 — 빛 알갱이들이 소용돌이치다 V 자로 모이고, 잠깐 빛난 뒤 다시 흩어진다(반복). beat 를 켜면 심장처럼 두 번씩 뛴다.
// (이름은 예전 큐브 로딩 자리를 그대로 쓰려고 CubeLoader 로 둔다)
import { useEffect, useRef } from 'react'

function vPoints(n: number): [number, number][] {
  // V: 왼쪽 획(위-왼 → 아래-가운데) + 오른쪽 획(아래-가운데 → 위-오른), 두께가 조금 있는 획
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0, t = Math.random(), w = (Math.random() - 0.5) * 0.16
    const x0 = left ? -0.62 : 0.62, y0 = -0.55, x1 = 0, y1 = 0.6
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
    const nx = left ? 0.88 : -0.88, ny = 0.48
    out.push([x + nx * w, y + ny * w])
  }
  return out
}

export default function CubeLoader({ label, size = 72, beat = false }: { label?: string; size?: number; beat?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = size * dpr; c.height = size * dpr
    const g = c.getContext('2d')!
    const N = Math.max(40, Math.round(size * 1.1))
    const target = vPoints(N)
    const P = target.map(([tx, ty], i) => ({ tx, ty, a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.45, sp: 0.8 + Math.random() * 1.4, hue: 205 + (i / N) * 55, d: Math.random() * 0.35 }))
    let raf = 0; const t0 = performance.now()
    const CYCLE = 2.8
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = (performance.now() - t0) / 1000
      const ph = reduce ? 0.5 : (t % CYCLE) / CYCLE
      // 0~0.15 흩어짐 · 0.15~0.5 모임 · 0.5~0.8 V 로 머묾 · 0.8~1 다시 흩어짐
      const gather = ph < 0.15 ? 0 : ph < 0.5 ? (ph - 0.15) / 0.35 : ph < 0.8 ? 1 : 1 - (ph - 0.8) / 0.2
      const hb = beat ? (() => { const q = (t % 1.1) / 1.1; return Math.exp(-Math.pow((q - 0.08) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((q - 0.28) / 0.05, 2)) })() : 0
      const S = size * dpr * 0.42 * (1 + 0.1 * hb)
      g.clearRect(0, 0, c.width, c.height)
      const glow = Math.max(0, gather - 0.85) / 0.15
      for (const p of P) {
        const k0 = Math.max(0, Math.min(1, (gather - p.d) / (1 - p.d)))
        const k = k0 * k0 * (3 - 2 * k0)
        const a = p.a + t * p.sp
        const ox = Math.cos(a) * p.r, oy = Math.sin(a) * p.r
        const x = ox + (p.tx - ox) * k, y = oy + (p.ty - oy) * k
        g.fillStyle = `hsla(${p.hue},90%,${58 + glow * 12}%,${0.45 + 0.5 * k})`
        g.beginPath(); g.arc(c.width / 2 + x * S, c.height / 2 + y * S, (1.1 + 0.9 * k + glow * 0.6) * dpr * (size / 72), 0, Math.PI * 2); g.fill()
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [size, beat])
  return (
    <div className="inline-flex flex-col items-center gap-2" role="status" aria-label={label ?? '불러오는 중'}>
      <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
      {label && <p className="text-[12.5px] text-[#8a93a6]">{label}</p>}
    </div>
  )
}
