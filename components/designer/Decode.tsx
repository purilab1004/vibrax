'use client'
// 글씨가 빛처럼 살며시 떠오른다 (나타날 때 한 번) — 외계 글자 없이 원래 글자 그대로
import { useEffect, useState } from 'react'

export default function Decode({ text, className }: { text: string; className?: string; replayOnHover?: boolean; ms?: number }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 30); return () => { clearTimeout(t); setOn(false) } }, [text])
  return <span className={`${className ?? ''} inline-block transition-[opacity,filter,transform] duration-700 ease-out ${on ? 'opacity-100 blur-0 translate-y-0' : 'opacity-0 blur-[6px] translate-y-1'}`}>{text}</span>
}
