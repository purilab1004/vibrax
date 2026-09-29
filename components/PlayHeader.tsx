'use client'
// 게임 플레이 오버레이 상단 — 배경 바 없이 게임 위에 얹힌다. 제목/AJ 한마디는 한 줄로 잠깐 보였다 사라지고, 좋아요·닫기는 유리질 버튼.
import { useEffect, useRef, useState } from 'react'

// genreLabel/genreColor 는 헤더에서 더 이상 표시하지 않지만(모바일·PC 동일 배치) 호출부 호환을 위해 받는다
export default function PlayHeader({ title, onClose, paused, onTogglePause, rotated, onToggleRotate, live, onToggleLive, onHide, onSave, saveState }: { genreLabel?: string; genreColor?: string; title: string; gameId?: string; onClose: () => void; paused?: boolean; onTogglePause?: () => void; rotated?: boolean; onToggleRotate?: () => void; live?: { viewers: number } | null; onToggleLive?: () => void; onHide?: () => void; onSave?: () => void; saveState?: 'idle' | 'saving' | 'saved' | 'guest' }) {
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
      {/* 모바일 — 상단 진행 바(다음 게임)에 가려져 빨간 끝만 보이던 LIVE 버튼 대신, 바 아래 작은 라벨 */}
      {onToggleLive && live && (
        <button onClick={onToggleLive} aria-label="방송 종료" className="md:hidden pointer-events-auto absolute flex items-center gap-1.5 rounded-full bg-[#e11d48] text-white text-[11px] font-bold px-2.5 h-7 shadow-[0_4px_12px_rgba(225,29,72,0.45)]" style={{ top: 'calc(3.6rem + var(--vbx-safe-top, 0px))', right: 'calc(0.75rem + var(--vbx-safe-right, 0px))' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE · {live.viewers}
        </button>
      )}
      <div className="flex items-center gap-3" style={{ paddingTop: 'calc(0.75rem + var(--vbx-safe-top, 0px))', paddingLeft: 'calc(0.75rem + var(--vbx-safe-left, 0px))', paddingRight: 'calc(0.75rem + var(--vbx-safe-right, 0px))' }}>
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
          {onToggleLive && (
            <button onClick={onToggleLive} aria-label={live ? '방송 종료' : '내 플레이 방송'} title={live ? '방송 종료' : '내 플레이를 라이브로 방송 (시청자는 관전만)'} className={`hidden md:flex h-9 px-3 rounded-full backdrop-blur-md border text-white text-[12px] font-bold flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition-colors ${live ? 'bg-[#e11d48] border-[#e11d48]' : 'bg-black/45 border-white/15 hover:bg-white hover:text-black'}`}>
              <span className={`w-2 h-2 rounded-full ${live ? 'bg-white animate-pulse' : 'bg-[#e11d48]'}`} />
              {live ? `LIVE · ${live.viewers}` : '내 플레이 방송'}
            </button>
          )}
          {onSave && (
            /* 게임 저장 — 게임 안 진행 상황을 계정에 보관해 다른 기기에서도 이어서 한다 */
            <button onClick={onSave} aria-label="게임 저장" title="게임 저장 (진행 상황을 계정에 보관)"
              className={`h-9 rounded-full backdrop-blur-md border text-white flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-all ${saveState === 'saved' ? 'w-auto px-3 bg-[#16a34a] border-[#16a34a]' : saveState === 'guest' ? 'w-auto px-3 bg-[#b45309] border-[#b45309]' : 'w-9 bg-black/45 border-white/15 hover:bg-white hover:text-black'}`}>
              {saveState === 'saved' ? <span className="text-[12px] font-bold">저장됨 ✓</span>
                : saveState === 'guest' ? <span className="text-[12px] font-bold">로그인 필요</span>
                : saveState === 'saving' ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4" /><rect x="8" y="13" width="8" height="7" /></svg>}
            </button>
          )}
          {onToggleRotate && (
            <button onClick={onToggleRotate} aria-label={rotated ? '세로 화면으로' : '가로 화면으로'} title={rotated ? '세로 화면으로' : '가로 화면으로'} className={`h-9 w-9 rounded-full backdrop-blur-md border text-white flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-colors ${rotated ? 'bg-[#2563eb] border-[#2563eb]' : 'bg-black/45 border-white/15 hover:bg-white hover:text-black'}`}>
              {rotated
                ? <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
                : <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="2" /><path d="M5.5 11v2" /><path d="M16 3.5l2.5 2.5L16 8.5" /><path d="M18.5 6H13" /></svg>}
            </button>
          )}
          {onHide && (
            /* 상단 바 숨기기 — 모바일에서 실수로 닫기(X)를 누르는 것을 막고 화면을 넓게 쓴다 */
            <button onClick={onHide} aria-label="상단 바 숨기기" title="상단 바 숨기기" className="h-9 w-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white/90 hover:bg-white hover:text-black transition-colors flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /><path d="M5 19h14" /></svg>
            </button>
          )}
          <button onClick={onClose} aria-label="닫기" title="닫기 (ESC)" className="h-9 w-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white/90 hover:bg-white hover:text-black transition-colors flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
