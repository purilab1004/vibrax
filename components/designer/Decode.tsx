'use client'
// 외계 글자 → 한글로 풀리는 글씨 (나타날 때·마우스를 올릴 때). 앞에서부터 차례로 제 글자가 된다.
import { useEffect, useRef, useState } from 'react'

const GLYPHS = '⏃⏚☊⎅⟒⎎☌⊑⟟⟊☍⌰⋔⋏⍜⌿⍾⍀⌇⏁⎍⎐⍙⌖⊬⋉◬⟁⧖⧗⌬⍟'
const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

export default function Decode({ text, className, replayOnHover = true, ms = 520 }: { text: string; className?: string; replayOnHover?: boolean; ms?: number }) {
  const [out, setOut] = useState(text)
  const raf = useRef(0)
  const run = () => {
    cancelAnimationFrame(raf.current)
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setOut(text); return }
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms)
      const done = Math.floor(k * text.length)
      setOut(text.split('').map((c, i) => (i < done || c === ' ' ? c : rnd())).join(''))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    step()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(run, 0); return () => { clearTimeout(t); cancelAnimationFrame(raf.current) } }, [text])
  return <span className={className} onMouseEnter={replayOnHover ? run : undefined}>{out}</span>
}
