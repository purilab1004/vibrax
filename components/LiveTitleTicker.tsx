'use client'

import { useEffect, useRef, useState } from 'react'

// 채팅 진행 중에는 게임 타이틀 자리에 AJ 채팅글이 아래에서 위로 올라오며 표시되고,
// 채팅이 잠시 멈추면 다시 게임 제목으로 복귀한다.
export default function LiveTitleTicker({ title }: { title: string }) {
  const [line, setLine] = useState<string | null>(null)
  const [key, setKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text) return
      setLine(text)
      setKey(k => k + 1)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setLine(null), 8000)
    }
    window.addEventListener('avatar:speak', handler)
    return () => {
      window.removeEventListener('avatar:speak', handler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden" style={{ height: 20 }}>
      {line ? (
        <div
          key={key}
          className="absolute inset-x-0 bottom-0 text-sm font-medium text-[#0e7573] truncate leading-5"
          style={{ animation: 'titleRise 0.4s ease-out' }}
        >
          {line}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 text-sm font-medium text-[#241f17] truncate leading-5">
          {title}
        </div>
      )}
    </div>
  )
}
