// lib/media/chroma.ts — 초록(크로마키) 배경 자동 제거 (서버 전용). 잭팟·상품 이미지처럼 초록 배경으로 올라온 사진의
// 테두리를 샘플해 초록이 많으면 초록 픽셀을 투명으로 바꾸고, 경계는 알파를 낮추고 녹색 번짐(spill)을 걷어낸다.
import sharp from 'sharp'

const MAX_EDGE = 1024

function greenness(r: number, g: number, b: number): number {
  // 0 = 초록 아님, 1 = 확실한 초록
  const m = Math.max(r, b)
  if (g < 70 || g <= m) return 0
  const d = g - m
  return Math.max(0, Math.min(1, (d - 18) / 50))
}

export async function removeGreenIfNeeded(input: Buffer, mime: string): Promise<{ buf: Buffer; mime: string; applied: boolean }> {
  if (!/^image\/(png|jpeg|jpg|webp)$/.test(mime)) return { buf: input, mime, applied: false }
  try {
    const { data, info } = await sharp(input, { animated: false }).resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const w = info.width, h = info.height
    // 테두리 샘플 — 초록 비율이 낮으면 손대지 않는다
    let n = 0, green = 0
    const sample = (x: number, y: number) => { const i = (y * w + x) * 4; n++; if (greenness(data[i], data[i + 1], data[i + 2]) > 0.6) green++ }
    for (let x = 0; x < w; x += 3) { sample(x, 0); sample(x, h - 1) }
    for (let y = 0; y < h; y += 3) { sample(0, y); sample(w - 1, y) }
    if (n === 0 || green / n < 0.3) return { buf: input, mime, applied: false }
    const out = Buffer.from(data)
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i], g = out[i + 1], b = out[i + 2]
      const m = Math.max(r, b)
      if (g <= m) continue
      out[i + 1] = m   // 녹색 번짐 제거 — 초록 성분을 R/B 최대값까지 눌러 노랑·흰 빛으로 (크로마키 사진 전체)
      const k = greenness(r, g, b)
      if (k > 0) out[i + 3] = Math.round(out[i + 3] * (1 - k))
    }
    const buf = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90, effort: 5 }).toBuffer()
    return { buf, mime: 'image/webp', applied: true }
  } catch { return { buf: input, mime, applied: false } }
}
