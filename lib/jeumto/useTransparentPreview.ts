// lib/jeumto/useTransparentPreview.ts
// 옛 프리뷰 PNG(에디터 배경 #0b0b0c 가 불투명하게 깔린 것)를 브라우저에서 키잉해 투명 PNG 로 바꾼다.
// 새 프리뷰(투명)는 그대로 통과. 결과는 URL 별로 캐시.
import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string>>()

function keyOut(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const id = ctx.getImageData(0, 0, c.width, c.height)
        const d = id.data
        // 모서리가 이미 투명하면 그대로 사용
        if (d[3] < 250) { resolve(url); return }
        const w = c.width, h = c.height, gridFrom = Math.floor(h * 0.8)
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2]
          const m = Math.max(r, g, b), mn = Math.min(r, g, b)
          if (m < 22) d[i + 3] = 0                       // 배경(#0b0b0c)·바닥 그림자
          else if (m < 34) d[i + 3] = Math.round(((m - 22) / 12) * 255) // 가장자리 부드럽게
          else if (m < 75 && m - mn < 10 && Math.floor(i / 4 / w) >= gridFrom) d[i + 3] = 0 // 아래쪽 회색 그리드 선
        }
        ctx.putImageData(id, 0, 0)
        resolve(c.toDataURL('image/png'))
      } catch { resolve(url) }
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

export function useTransparentPreview(url: string | null | undefined): string | null {
  const [out, setOut] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    let p = cache.get(url)
    if (!p) { p = keyOut(url); cache.set(url, p) }
    p.then((r) => { if (alive) setOut(r) })
    return () => { alive = false }
  }, [url])
  return url ? out : null
}
