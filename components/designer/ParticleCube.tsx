'use client'
// 만드는 중 표시 — 작은 빛 알갱이들이 날아와 3×3 루빅스 큐브로 조립되고, 한 층씩 돌며 심장처럼 두 번씩 뛴다.
// 무대 오른쪽 위 구석에 작게 띄운다 (2D 캔버스에 간단한 3D 투영 — 가볍게).
import { useEffect, useRef } from 'react'

export default function ParticleCube({ size = 96 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = size * dpr; c.height = size * dpr
    const g = c.getContext('2d')!
    // 큐블렛 27개 × 알갱이 8개(모서리 점) = 216 알갱이
    type P = { cx: number; cy: number; cz: number; ox: number; oy: number; oz: number; sx: number; sy: number; sz: number; d: number; hue: number }
    const P: P[] = []
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      const hue = 205 + ((x + y + z + 3) / 6) * 55
      for (let k = 0; k < 8; k++) {
        const ox = (k & 1 ? 1 : -1) * 0.36, oy = (k & 2 ? 1 : -1) * 0.36, oz = (k & 4 ? 1 : -1) * 0.36
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 2.5
        P.push({ cx: x, cy: y, cz: z, ox, oy, oz, sx: Math.cos(a) * r, sy: (Math.random() - 0.5) * 5, sz: Math.sin(a) * r, d: Math.random() * 0.6, hue })
      }
    }
    let raf = 0; const t0 = performance.now()
    let layer = { axis: 0, i: 0, ang: 0, t: 0 }
    const rot = (v: number[], ax: number, a: number) => { const [x, y, z] = v, s = Math.sin(a), co = Math.cos(a); return ax === 0 ? [x, y * co - z * s, y * s + z * co] : ax === 1 ? [x * co + z * s, y, -x * s + z * co] : [x * co - y * s, x * s + y * co, z] }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = (performance.now() - t0) / 1000
      g.clearRect(0, 0, c.width, c.height)
      // 층 돌리기: 1.2초마다 한 층을 90도
      layer.t += 1 / 60
      if (layer.t > 1.2) { layer = { axis: (Math.random() * 3) | 0, i: ((Math.random() * 3) | 0) - 1, ang: 0, t: 0 } }
      const lp = Math.min(1, layer.t / 0.5), ease = lp * lp * (3 - 2 * lp)
      // 심장 박동(쿵-쿵 … 쉼)
      const ph = (t % 1.1) / 1.1, beat = Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.28) / 0.05, 2))
      const scale = size * 0.14 * (1 + 0.12 * beat) * dpr
      const yaw = t * 0.6, pitch = -0.55
      const pts: [number, number, number, number, number][] = []
      for (const p of P) {
        const asm = Math.min(1, Math.max(0, (t - p.d) / 1.2)), e = asm * asm * (3 - 2 * asm)   // 날아와 조립
        let v = [p.cx + p.ox, p.cy + p.oy, p.cz + p.oz]
        const inLayer = [p.cx, p.cy, p.cz][layer.axis] === layer.i
        if (inLayer && asm >= 1) v = rot(v, layer.axis, (Math.PI / 2) * ease)
        v = [p.sx + (v[0] - p.sx) * e, p.sy + (v[1] - p.sy) * e, p.sz + (v[2] - p.sz) * e]
        v = rot(rot(v, 1, yaw), 0, pitch)
        const zc = 7, f = zc / (zc - v[2])
        pts.push([c.width / 2 + v[0] * scale * f, c.height / 2 - v[1] * scale * f, v[2], p.hue, f])
      }
      pts.sort((a, b) => a[2] - b[2])
      for (const [x, y, z, hue, f] of pts) {
        g.fillStyle = `hsla(${hue},90%,${55 + z * 4}%,${0.55 + 0.35 * (z + 2) / 4})`
        g.beginPath(); g.arc(x, y, 1.6 * dpr * f * (1 + 0.25 * beat), 0, Math.PI * 2); g.fill()
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [size])
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
}
