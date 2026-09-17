// 관리자 — 잭팟 만들기/목록/추첨/취소
import { requireAdmin } from '@/lib/admin/guard'
import { optimizeImage } from '@/lib/media/optimize'

export const runtime = 'nodejs'
const BUCKET = 'media'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data, error } = await g.admin.from('jackpots').select('*').order('created_at', { ascending: false }).limit(100)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const ids = (data ?? []).map((j) => (j as { winner_user_id: string | null }).winner_user_id).filter((x): x is string => !!x)
  const names: Record<string, string> = {}
  if (ids.length) { const { data: profs } = await g.admin.from('profiles').select('id,username,agent_name,email').in('id', ids); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null; email?: string | null }[]) names[p.id] = `${p.agent_name ?? p.username ?? '회원'}${p.email ? ` (${p.email})` : ''}` }
  return Response.json({ items: (data ?? []).map((j) => ({ ...(j as object), winner_name: names[(j as { winner_user_id: string | null }).winner_user_id ?? ''] ?? null })) })
}

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const fd = await req.formData().catch(() => null)
  if (!fd) return Response.json({ error: 'multipart 필요' }, { status: 400 })
  const title = String(fd.get('title') ?? '').trim(); const description = String(fd.get('description') ?? '').trim() || null
  const entry_cost = Math.max(1, Math.min(100000, Number(fd.get('entry_cost') ?? 50) || 50))
  const ends_at = String(fd.get('ends_at') ?? '')
  if (!title || !ends_at || isNaN(Date.parse(ends_at))) return Response.json({ error: '제목과 마감 시각이 필요해요' }, { status: 400 })
  let image_url: string | null = null
  const file = fd.get('image'); 
  if (file instanceof File && file.size > 0) {
    const raw = Buffer.from(await file.arrayBuffer())
    const opt = await optimizeImage(raw, file.type || 'image/png')
    const path = `jackpot/${crypto.randomUUID()}.${opt.converted ? 'webp' : (file.name.split('.').pop() || 'png')}`
    const { error: upErr } = await g.admin.storage.from(BUCKET).upload(path, opt.buf, { contentType: opt.mime, upsert: false, cacheControl: '31536000' })
    if (upErr) return Response.json({ error: '이미지 업로드 실패: ' + upErr.message }, { status: 500 })
    image_url = g.admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }
  const { data, error } = await g.admin.from('jackpots').insert([{ title, description, image_url, entry_cost, ends_at: new Date(ends_at).toISOString(), created_by: g.user.id }] as never).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { id?: string; action?: 'settle' | 'cancel' } | null
  if (!body?.id || !body.action) return Response.json({ error: 'bad request' }, { status: 400 })
  if (body.action === 'settle') {
    // 관리자 세션으로 RPC (is_admin 확인은 함수 안에서)
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('settle_jackpot', { p_jackpot_id: body.id } as never)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true, winner: data })
  }
  const { error } = await g.admin.from('jackpots').update({ status: 'cancelled', drawn_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'open')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // 취소 시 참여 코인 환불
  const { data: ents } = await g.admin.from('jackpot_entries').select('user_id,coins').eq('jackpot_id', body.id)
  for (const e of (ents ?? []) as { user_id: string; coins: number }[]) { const { data: p } = await g.admin.from('profiles').select('vcoin').eq('id', e.user_id).maybeSingle(); await g.admin.from('profiles').update({ vcoin: ((p as { vcoin: number } | null)?.vcoin ?? 0) + e.coins }).eq('id', e.user_id) }
  return Response.json({ ok: true, refunded: (ents ?? []).length })
}
