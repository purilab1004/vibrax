'use client'
// 카드 타이틀 — 화면에 들어오면(캐릭터가 윙~ 하고 들어온 뒤) 글자가 아래에서 떠오르며 등장
import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function RevealTitle({ children, className = '', delay = 0.55 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setShown(true); io.disconnect() }
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`${className} ${shown ? 'title-in' : 'opacity-0'}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}
