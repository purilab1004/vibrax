'use client'

import { useEffect, useRef, useState } from 'react'

// 스크롤 리빌 — 뷰포트에 처음 들어올 때 아래에서 위로 올라오며 등장 (한 번만)
// delay(ms)를 인덱스별로 주면 하나씩 쌓이듯 순차 등장한다.
export default function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: shown ? `${delay}ms` : '0ms' } : undefined}
      className={`reveal-item ${shown ? 'reveal-shown' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
