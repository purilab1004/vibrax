// 관리자 — 잭팟 상품(이미지·설명) 등록/목록/삭제. 초록 배경 이미지는 자동으로 투명 처리
import { requireAdmin } from '@/lib/admin/guard'
import { uploadPrizeImage } from '@/lib/media/jackpot-image'

export const runtime = 'nodejs'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data, error } = await g.admin.from('products').select('*').order('sort').order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  return Response.json({ items: data ?? [] })
}
export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const fd = await req.formData().catch(() => null)
  if (!fd) return Response.json({ error: 'multipart 필요' }, { status: 400 })
  const title = String(fd.get('title') ?? '').trim(); const description = String(fd.get('description') ?? '').trim() || null
  const coin_price = Math.max(0, Number(fd.get('coin_price') ?? 0) || 0)
  if (!title) return Response.json({ error: '상품명이 필요해요' }, { status: 400 })
  let image_url: string | null = null
  const file = fd.get('image')
  if (file instanceof File && file.size > 0) {
    const up = await uploadPrizeImage(g.admin, file, 'product')
    if ('error' in up) return Response.json({ error: up.error }, { status: 500 })
    image_url = up.url
  }
  const { data, error } = await g.admin.from('products').insert([{ title, description, image_url, coin_price }] as never).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}
export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return Response.json({ error: 'id' }, { status: 400 })
  const { error } = await g.admin.from('products').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
