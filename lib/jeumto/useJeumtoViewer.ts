// lib/jeumto/useJeumtoViewer.ts — viewer.js 생명주기를 React ref 에 묶는 훅 (SSR 안전: effect 안에서만 생성)
import { useEffect, type RefObject } from 'react'
import { createJeumtoViewer } from './viewer.js'
import type { JeumtoCharacterData } from './config'

export interface JeumtoViewerHandle {
  load(data: JeumtoCharacterData): void
  speak(ms: number): void
  stop(): void
  dispose(): void
}

export function useJeumtoViewer(
  containerRef: RefObject<HTMLDivElement | null>,
  viewerRef: { current: JeumtoViewerHandle | null },
  opts: { interactive?: boolean; shadows?: boolean },
): void {
  const { interactive = false, shadows = false } = opts
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const v = createJeumtoViewer(el, { interactive, shadows }) as unknown as JeumtoViewerHandle
    viewerRef.current = v
    return () => { viewerRef.current = null; v.dispose() }
  }, [containerRef, viewerRef, interactive, shadows])
}
