// lib/media/jackpot-image.ts — 잭팟·상품 이미지 업로드 (서버 전용). 초록(크로마키) 배경이면 투명으로 걷어내고, 투명 PNG 는 알파 정리, 나머지는 WebP 최적화.
import type { createAdminClient } from '@/lib/supabase/admin'
import { removeGreenIfNeeded, cleanAlphaIfTransparent } from '@/lib/media/chroma'
import { optimizeImage } from '@/lib/media/optimize'

const BUCKET = 'media'

export async function uploadPrizeImage(admin: ReturnType<typeof createAdminClient>, file: File, folder: 'jackpot' | 'product'): Promise<{ url: string } | { error: string }> {
  const raw = Buffer.from(await file.arrayBuffer())
  const mime = file.type || 'image/png'
  // 초록 배경이면 걷어내고, 이미 투명 배경이면 알파만 정리 (둘 다 반투명 잔여를 0/255 로 스냅)
  let keyed = await removeGreenIfNeeded(raw, mime)
  if (!keyed.applied) keyed = await cleanAlphaIfTransparent(raw, mime)
  let buf: Buffer, contentType: string, ext: string
  if (keyed.applied) { buf = keyed.buf; contentType = keyed.mime; ext = 'webp' }
  else { const opt = await optimizeImage(raw, mime); buf = opt.buf; contentType = opt.mime; ext = opt.converted ? 'webp' : (file.name.split('.').pop() || 'png') }
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType, upsert: false, cacheControl: '31536000' })
  if (error) return { error: '이미지 업로드 실패: ' + error.message }
  return { url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}
