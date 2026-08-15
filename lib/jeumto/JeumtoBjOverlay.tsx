'use client'
// lib/jeumto/JeumtoBjOverlay.tsx — 게임 내 BJ: 제작자가 저장한 점토 아바타.
// AiBjPanel 이 LLM 중계 텍스트로 dispatch 하는 `avatar:speak` { text } 이벤트를 받아
// TTS 재생 + 말하기 애니메이션(입 비즘/머리 까딱)을 돌린다. 부모(아바타 박스)를 채운다.
import { useEffect, useRef, useState } from 'react'
import type { AvatarConfig } from './config'
import { fetchCharacterData } from './storage'
import { speakText } from './tts'
import { useJeumtoViewer, type JeumtoViewerHandle } from './useJeumtoViewer'

export default function JeumtoBjOverlay({ config }: { config: AvatarConfig }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<JeumtoViewerHandle | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const loaded = !!config.dataUrl && loadedUrl === config.dataUrl
  const [bubble, setBubble] = useState<string | null>(null)
  useJeumtoViewer(containerRef, viewerRef, { interactive: false })

  useEffect(() => {
    let cancelled = false
    const url = config.dataUrl
    if (!url) return
    fetchCharacterData(url).then((data) => {
      if (cancelled || !data || !viewerRef.current) return
      try { viewerRef.current.load(data); setLoadedUrl(url) } catch (e) { console.error('[jeumto] load failed', e) }
    })
    return () => { cancelled = true }
  }, [config.dataUrl])

  useEffect(() => {
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const handler = async (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text) return
      setBubble(text)
      if (endTimer) clearTimeout(endTimer)
      const end = () => { setBubble(null); viewerRef.current?.stop() }
      let ms = 4000
      try {
        ms = (await speakText(text, config.voice)).durationMs
      } catch (err) {
        console.error('[jeumto bj] TTS failed:', err)
        ms = Math.min(6000, 1500 + text.length * 80)
      }
      viewerRef.current?.speak(ms)
      endTimer = setTimeout(end, ms + 400)
    }
    window.addEventListener('avatar:speak', handler)
    return () => { window.removeEventListener('avatar:speak', handler); if (endTimer) clearTimeout(endTimer) }
  }, [config.voice])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050508' }}>
      <div ref={containerRef} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          {config.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          ) : null}
          <div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin relative" />
          <span className="font-pixel text-[8px] text-[#857a68] tracking-widest relative">BJ 로딩 중…</span>
        </div>
      )}
      {bubble && (
        <div className="absolute left-1.5 right-1.5 top-1.5 pointer-events-none">
          <div className="bg-black/75 border border-[#ddd3bf] rounded px-2 py-1 text-[10px] text-gray-100 leading-snug line-clamp-3">
            💬 {bubble}
          </div>
        </div>
      )}
    </div>
  )
}
