'use client'
// lib/jeumto/JeumtoView.tsx — 저장된 점토 아바타를 보여주는 뷰 (프로필 "내 캐릭터" 등).
// config.dataUrl 의 JSON 을 받아 viewer 에 로드한다. 부모가 크기를 정해준다.
import { useEffect, useRef, useState } from 'react'
import type { AvatarConfig } from './config'
import { fetchCharacterData } from './storage'
import type { JeumtoViewerHandle } from './useJeumtoViewer'
import { useJeumtoViewer } from './useJeumtoViewer'

interface Props {
  config: AvatarConfig
  interactive?: boolean
  className?: string
}

export default function JeumtoView({ config, interactive = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 어떤 URL 을 성공/실패로 처리했는지 기록 → 현재 config.dataUrl 과 비교해 상태를 도출 (effect 안 동기 setState 회피)
  const [done, setDone] = useState<{ url: string; ok: boolean } | null>(null)
  const status: 'loading' | 'ready' | 'error' =
    !config.dataUrl ? 'error' : done?.url === config.dataUrl ? (done.ok ? 'ready' : 'error') : 'loading'
  const viewerRef = useRef<JeumtoViewerHandle | null>(null)
  useJeumtoViewer(containerRef, viewerRef, { interactive })

  useEffect(() => {
    let cancelled = false
    const url = config.dataUrl
    if (!url) return
    fetchCharacterData(url).then((data) => {
      if (cancelled) return
      if (!data || !viewerRef.current) { setDone({ url, ok: false }); return }
      try { viewerRef.current.load(data); setDone({ url, ok: true }) } catch (e) { console.error('[jeumto] load failed', e); setDone({ url, ok: false }) }
    })
    return () => { cancelled = true }
  }, [config.dataUrl])

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {status === 'error' && config.previewUrl && (
        // 데이터가 없거나 못 받으면 프리뷰 PNG 로 대체
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.previewUrl} alt={config.name} className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  )
}
