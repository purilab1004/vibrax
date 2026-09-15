'use client'
// 게임 플레이 오버레이 상단 — 배경 바 없이 게임 위에 얹힌다. 제목/AJ 한마디는 한 줄로 잠깐 보였다 사라지고, 좋아요·닫기는 유리질 버튼.
import { useEffect, useRef, useState } from 'react'
import LikeButton from './LikeButton'

// genreLabel/genreColor 는 헤더에서 더 이상 표시하지 않지만(모바일·PC 동일 배치) 호출부 호환을 위해 받는다
export default function PlayHeader({ title, gameId, onClose, paused, onTogglePause }: { genreLabel?: string; genreColor?: string; title: string; gameId: string; onClose: () => void; paused?: boolean; onTogglePause?: () => void }) {
  const [line, setLine] = useState<string | null>(title)
  const [key, setKey] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = (text: string, ms: number) => { setLine(text); setKey(k => k + 1); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setLine(null), ms) }
  useEffect(() => {
    timer.current = setTimeout(() => setLine(null), 6000)  // 제목은 처음 6초
    const h = (e: Event) => { const t = (e as CustomEvent<{ text: string }>).detail?.text?.trim(); if (t) show(t, 8000) }
    window.addEventListener('avatar:speak', h)
    return () => { window.removeEventListener('avatar:speak', h); if (timer.current) clearTimeout(timer.current) }
  }, [])
  return (
    <div className="absolute inset-x-0 top-0 z-20 pointer-events-none">
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onTogglePause && (
            <button onClick={onTogglePause} aria-label={paused ? '계속하기' : '일시정지'} title={paused ? '계속하기' : '일시정지'} className={`pointer-events-auto h-9 w-9 rounded-full backdrop-blur-md border text-white flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-colors ${paused ? 'bg-[#2563eb] border-[#2563eb]' : 'bg-black/45 border-white/15 hover:bg-white hover:text-black'}`}>
              {paused
                ? <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
                : <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>}
            </button>
          )}

          <div className="relative min-w-0 flex-1 h-6 overflow-hidden hidden">
            {line && (
              <div key={key} className="absolute inset-x-0 bottom-0 truncate text-[13.5px] font-semibold text-white leading-6 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] play-line" title={line}>{line}</div>
            )}
          </div>
        </div>
        <div className="pointer-events-auto shrink-0 flex items-center gap-2">
          <div className="h-9 px-3 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white flex items-center shadow-[0_2px_10px_rgba(0,0,0,0.35)]"><LikeButton gameId={gameId} size="md" dark /></div>
          <button onClick={onClose} aria-label="닫기" title="닫기 (ESC)" className="h-9 w-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white/90 hover:bg-white hover:text-black transition-colors flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
