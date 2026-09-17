'use client'
// 썸네일의 주요 색상(hue) 추출 — 쇼츠 제목의 3D 층·크롬 채움 색을 배경과 어울리게 맞추는 데 쓴다.
// 작은 캔버스에 그려 채도 높은 픽셀의 색상각을 원형 평균으로 구한다. CORS 로 못 읽으면 null(기본 핑크).
import { useEffect, useState } from 'react'

const cache = new Map<string, number | null>()
const inflight = new Map<string, Promise<number | null>>()

function compute(url: string): Promise<number | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!)
  if (inflight.has(url)) return inflight.get(url)!
  const p = new Promise<number | null>((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const N = 28
        const cv = document.createElement('canvas'); cv.width = N; cv.height = N
        const ctx = cv.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0, N, N)
        const d = ctx.getImageData(0, 0, N, N).data
        let sx = 0, sy = 0, w = 0
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
          const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
          const l = (max + min) / 2
          const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
          if (s < 0.25 || l < 0.15 || l > 0.9) continue // 회색·너무 어둡거나 밝은 픽셀 제외
          let h = 0
          if (delta > 0) { if (max === r) h = ((g - b) / delta) % 6; else if (max === g) h = (b - r) / delta + 2; else h = (r - g) / delta + 4 }
          const ang = (h * 60 + 360) % 360 * Math.PI / 180
          const wt = s * (1 - Math.abs(l - 0.5))
          sx += Math.cos(ang) * wt; sy += Math.sin(ang) * wt; w += wt
        }
        if (w < 1) { resolve(null); return }
        resolve(((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  }).then((v) => { cache.set(url, v); inflight.delete(url); return v })
  inflight.set(url, p)
  return p
}

export function useDominantHue(url?: string | null): number | null {
  const [hue, setHue] = useState<number | null>(() => (url && cache.has(url) ? cache.get(url)! : null))
  useEffect(() => {
    if (!url) return
    let alive = true
    compute(url).then((v) => { if (alive) setHue(v) })
    return () => { alive = false }
  }, [url])
  return hue
}
