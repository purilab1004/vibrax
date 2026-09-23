'use client'
// /games 피드(모바일): 첫 카드에서 위로 당기면(손가락을 아래로 끌면) 홈(프롬프트 섹션)으로 — 홈에서 아래로 넘기면 쇼츠로 오는 흐름의 반대 방향
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PullToHome() {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const start = useRef<number | null>(null)
  const fired = useRef(false)
  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return
    const THRESH = 90
    const onStart = (e: TouchEvent) => { start.current = window.scrollY <= 1 ? e.touches[0].clientY : null; fired.current = false }
    const onMove = (e: TouchEvent) => {
      if (start.current === null || fired.current) return
      const dy = e.touches[0].clientY - start.current
      if (window.scrollY > 1) { start.current = null; setPull(0); return }
      setPull(Math.max(0, Math.min(dy, THRESH + 40)))
      if (dy > THRESH) { fired.current = true; setPull(0); router.push('/') }
    }
    const onEnd = () => { start.current = null; setPull(0) }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd); window.addEventListener('touchcancel', onEnd)
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); window.removeEventListener('touchcancel', onEnd) }
  }, [router])
  if (pull <= 0) return null
  return (
    <div className="md:hidden fixed inset-x-0 z-[66] flex justify-center pointer-events-none" style={{ top: `calc(var(--st, 0px) + ${Math.round(pull * 0.5)}px)`, opacity: Math.min(1, pull / 60) }}>
      <div className="rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white font-pixel text-[10px] tracking-widest px-4 py-2 shadow-lg">▲ 홈으로</div>
    </div>
  )
}
