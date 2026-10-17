'use client'
// 루빅스 큐브 로딩 — 기울어진 3×3 큐브가 천천히 돌고, 앞면의 줄·칸이 섞였다가 거꾸로 돌아 맞춰진다(반복).
// 3D 라이브러리 없이 CSS 3D 로 가볍게.
import { useEffect, useRef, useState } from 'react'

const COLORS = ['#2563eb', '#38bdf8', '#7c5cf6', '#e0e7ff', '#60a5fa', '#a5b4fc']
type Move = { row: boolean; i: number; dir: 1 | -1 }

// 한 줄(가로) 또는 한 칸(세로)을 한 칸씩 밀기
function apply(g: number[], m: Move): number[] {
  const n = g.slice(), at = (r: number, c: number) => r * 3 + c
  for (let k = 0; k < 3; k++) {
    const from = m.row ? at(m.i, (k - m.dir + 3) % 3) : at((k - m.dir + 3) % 3, m.i)
    const to = m.row ? at(m.i, k) : at(k, m.i)
    n[to] = g[from]
  }
  return n
}

export default function CubeLoader({ label, size = 72 }: { label?: string; size?: number }) {
  // 맞춰진 앞면 = 같은 색 9칸, 옆·윗면은 다른 색
  const solved = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const [face, setFace] = useState(() => [0, 1, 2, 3, 4, 5, 1, 2, 3])
  const [hint, setHint] = useState<Move | null>(null)
  const hist = useRef<Move[]>([])
  const phase = useRef<'mix' | 'solve' | 'hold'>('mix')
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let g = solved.slice(), hold = 0
    const t = setInterval(() => {
      if (phase.current === 'mix') {
        const m: Move = { row: Math.random() < 0.5, i: (Math.random() * 3) | 0, dir: Math.random() < 0.5 ? 1 : -1 }
        g = apply(g.map((c, i) => (hist.current.length === 0 ? [0, 1, 2, 1, 4, 5, 2, 5, 3][i] : c)), m); hist.current.push(m); setHint(m)
        if (hist.current.length >= 7) phase.current = 'solve'
      } else if (phase.current === 'solve') {
        const m = hist.current.pop()
        if (!m) { phase.current = 'hold'; hold = 0; g = solved.slice(); setHint(null) }
        else { const back: Move = { ...m, dir: (m.dir === 1 ? -1 : 1) as 1 | -1 }; g = apply(g, back); setHint(back); if (!hist.current.length) g = solved.slice() }
      } else { hold++; setHint(null); if (hold > 3) phase.current = 'mix' }
      setFace(g.slice())
    }, 360)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const s = size, cell = s / 3
  const sideFace = (rot: string, color: string) => (
    <div className="absolute inset-0 grid grid-cols-3 gap-[2px] p-[2px] bg-[#1f2937]/10" style={{ transform: `${rot} translateZ(${s / 2}px)`, backfaceVisibility: 'hidden' }}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className="rounded-[2px]" style={{ background: color, opacity: 0.92 }} />)}
    </div>
  )
  return (
    <div className="inline-flex flex-col items-center gap-3" role="status" aria-label={label ?? '불러오는 중'}>
      <div style={{ width: s, height: s, perspective: s * 5 }}>
        <div className="relative w-full h-full vx-cube-spin" style={{ transformStyle: 'preserve-3d' }}>
          {/* 앞면 — 섞였다 맞춰지는 면 */}
          <div className="absolute inset-0 grid grid-cols-3 gap-[2px] p-[2px] bg-[#1f2937]/10" style={{ transform: `translateZ(${s / 2}px)` }}>
            {face.map((c, i) => {
              const r = (i / 3) | 0, col = i % 3
              const moving = hint && (hint.row ? r === hint.i : col === hint.i)
              return <span key={i} className="rounded-[2px] transition-[background-color,transform] duration-300" style={{ background: COLORS[c % COLORS.length], transform: moving ? `translate${hint!.row ? 'X' : 'Y'}(${hint!.dir * cell * 0.12}px)` : 'none' }} />
            })}
          </div>
          {sideFace('rotateY(90deg)', COLORS[1])}
          {sideFace('rotateX(90deg)', COLORS[2])}
          {sideFace('rotateY(-90deg)', COLORS[4])}
          {sideFace('rotateX(-90deg)', COLORS[5])}
          {sideFace('rotateY(180deg)', COLORS[3])}
        </div>
      </div>
      {label && <p className="text-[12.5px] text-[#8a93a6]">{label}</p>}
    </div>
  )
}
