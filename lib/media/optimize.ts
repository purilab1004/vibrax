// lib/media/optimize.ts — 미디어 업로드 최적화 (서버 전용). jpg/png/webp → WebP 로 변환·축소해 로딩을 빠르게.
//  · 작은 픽셀아트(긴 변 ≤ 256px)·투명 이미지는 무손실 WebP (계단·알파 보존), 나머지는 손실 WebP q82
//  · 긴 변 2048px 초과는 2048 로 축소(배경용), 애니메이션 GIF·SVG 는 그대로
//  · 변환 결과가 원본보다 크면 원본 유지
import sharp from 'sharp'

export interface Optimized { buf: Buffer; mime: string; ext: string; width: number | null; height: number | null; converted: boolean; from: number }

const MAX_EDGE = 2048

export async function optimizeImage(input: Buffer, mime: string): Promise<Optimized> {
  const base: Optimized = { buf: input, mime, ext: extOf(mime), width: null, height: null, converted: false, from: input.length }
  if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(mime)) return base
  try {
    const img = sharp(input, { animated: false })
    const meta = await img.metadata()
    base.width = meta.width ?? null; base.height = meta.height ?? null
    // 애니메이션 GIF 는 프레임 보존을 위해 그대로
    if (mime === 'image/gif' && (meta.pages ?? 1) > 1) return base
    const w = meta.width ?? 0, h = meta.height ?? 0
    const small = Math.max(w, h) <= 256
    const lossless = small || (meta.hasAlpha === true && Math.max(w, h) <= 1024)
    let pipe = sharp(input)
    if (Math.max(w, h) > MAX_EDGE) pipe = pipe.resize({ width: w >= h ? MAX_EDGE : undefined, height: h > w ? MAX_EDGE : undefined, fit: 'inside', kernel: 'lanczos3' })
    const out = await pipe.webp(lossless ? { lossless: true, effort: 5 } : { quality: 82, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true })
    const shrunk = Math.max(w, h) > MAX_EDGE
    if (!shrunk && out.data.length >= input.length) return base   // 이득이 없으면 원본
    return { buf: out.data, mime: 'image/webp', ext: 'webp', width: out.info.width, height: out.info.height, converted: true, from: input.length }
  } catch { return base }
}

export function extOf(mime: string): string {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' } as Record<string, string>)[mime] ?? 'bin'
}
