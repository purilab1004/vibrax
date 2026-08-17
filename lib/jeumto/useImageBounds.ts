// lib/jeumto/useImageBounds.ts — 투명 PNG 의 실제 보이는 영역(알파 bbox)을 % 로 계산. 말풍선을 머리 바로 위,
// 그림자를 발 바로 밑에 붙이기 위해 쓴다. URL 별 캐시.
import { useEffect, useState } from 'react'

export interface Bounds { top: number; bottom: number; left: number; right: number } // 0..1
const cache = new Map<string, Promise<Bounds | null>>()

function measure(url: string): Promise<Bounds | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const S = 64
        const c = document.createElement('canvas'); c.width = S; c.height = S
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, S, S)
        const d = ctx.getImageData(0, 0, S, S).data
        let top = S, bottom = -1, left = S, right = -1
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          if (d[(y * S + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x }
        }
        if (bottom < 0) { resolve(null); return }
        resolve({ top: top / S, bottom: (bottom + 1) / S, left: left / S, right: (right + 1) / S })
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function useImageBounds(url: string | null | undefined): Bounds | null {
  const [b, setB] = useState<Bounds | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    let p = cache.get(url)
    if (!p) { p = measure(url); cache.set(url, p) }
    p.then((r) => { if (alive) setB(r) })
    return () => { alive = false }
  }, [url])
  return url ? b : null
}
