// /api/library/preview/[id] — 갤러리 미리보기: 원본 대신 640px 로 줄이고 'vibrexcup.com' 워터마크를 바둑판으로 얹은 WEBP.
// 비로그인 방문자는 이것만 본다(원본 URL 은 로그인 회원에게만). CDN 에 오래 캐시해 원본 저장소 트래픽도 줄인다.
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { WATERMARK_TILE } from '@/lib/media/watermark-tile'

export const runtime = 'nodejs'
const EDGE = 640

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad id', { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('media_assets').select('url,kind,mime,status,visibility').eq('id', id).maybeSingle()
  const a = data as { url: string; kind: string; mime: string | null; status: string; visibility?: string } | null
  if (!a || a.status !== 'active' || a.visibility === 'admin' || a.kind === 'audio' || a.kind === 'model3d' || !(a.mime ?? 'image/').startsWith('image/')) return new Response('not found', { status: 404 })
  const src = await fetch(a.url).catch(() => null)
  if (!src?.ok) return new Response('not found', { status: 404 })
  try {
    const base = sharp(Buffer.from(await src.arrayBuffer()), { animated: false }).resize(EDGE, EDGE, { fit: 'inside', withoutEnlargement: true })
    const { data: buf, info } = await base.png().toBuffer({ resolveWithObject: true })
    // 작은 그림(픽셀아트 등)은 타일을 줄여 글씨가 그림을 다 덮지 않게
    const tile = info.width < 300 || info.height < 200 ? await sharp(WATERMARK_TILE).resize(Math.max(120, Math.round(info.width * 0.8))).png().toBuffer() : WATERMARK_TILE
    const out = await sharp(buf).composite([{ input: tile, tile: true, gravity: 'northwest' }]).webp({ quality: 72 }).toBuffer()
    return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' } })
  } catch {
    return new Response('preview failed', { status: 500 })
  }
}
