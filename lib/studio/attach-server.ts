// 서버 전용 — 첨부 이미지를 작은 WebP 썸네일(data URL)로 만들어 채팅 메시지에 함께 저장한다
import sharp from 'sharp'
import { encodeAttach } from './attach'

export async function buildAttachNote(images: { media_type: string; data: string }[], sounds: { name: string }[]): Promise<string> {
  const thumbs: string[] = []
  for (const img of images.slice(0, 3)) {
    try {
      const buf = await sharp(Buffer.from(img.data, 'base64')).resize(160, 160, { fit: 'cover' }).webp({ quality: 70 }).toBuffer()
      if (buf.length < 40_000) thumbs.push(`data:image/webp;base64,${buf.toString('base64')}`)
    } catch { /* 썸네일 실패는 무시 */ }
  }
  return encodeAttach({ images: thumbs, sounds: sounds.map(s => s.name) })
}
