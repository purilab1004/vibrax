// lib/jeumto/useJeumtoViewer.ts — viewer.js 생명주기를 React ref 에 묶는 훅 (SSR 안전: effect 안에서만 생성)
import { useEffect, type RefObject } from 'react'
import { createJeumtoViewer } from './viewer.js'
import type { JeumtoCharacterData } from './config'

export interface JeumtoViewerHandle {
  load(data: JeumtoCharacterData): void
  loadDefault(color?: string): void
  snapshot(size?: number, opts?: { blink?: boolean; talk?: boolean }): HTMLCanvasElement
  renderPosed(pose: { yaw: number; pitch: number; roll: number; jaw: number; blink: number }, size?: number): HTMLCanvasElement
  speak(ms: number): void
  stop(): void
  dispose(): void
}

export function useJeumtoViewer(
  containerRef: RefObject<HTMLDivElement | null>,
  viewerRef: { current: JeumtoViewerHandle | null },
  opts: { interactive?: boolean; shadows?: boolean; zoom?: number },
): void {
  const { interactive = false, shadows = false, zoom = 1 } = opts
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // WebGL 컨텍스트를 못 만드는 환경(GPU 차단·컨텍스트 한도 초과 등)에서 예외가 페이지 전체를 오류 화면으로 떨어뜨리지 않게 — 아바타만 비운다
    let v: JeumtoViewerHandle | null = null
    try { v = createJeumtoViewer(el, { interactive, shadows, zoom }) as unknown as JeumtoViewerHandle }
    catch (e) { console.warn('[jeumto] viewer unavailable (WebGL)', e); el.innerHTML = ''; return }
    viewerRef.current = v
    return () => { viewerRef.current = null; try { v?.dispose() } catch { /* */ } }
  }, [containerRef, viewerRef, interactive, shadows, zoom])
}
