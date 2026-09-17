// 디자이너 업로드 — 직분 designer/admin 만. 'pending' 으로 들어가고 관리자가 승인하면 공개(active). GET = 내 등록물
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEDIA_KINDS, toAssetName, type MediaKind } from '@/lib/media/assets'
import { optimizeImage } from '@/lib/media/optimize'

export const runtime = 'nodejs'
const BUCKET = 'media'
const MAX = 8_000_000

async function me() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return { user, role: (prof as { role?: string } | null)?.role ?? 'user', admin }
}

export async function GET() {
  const m = await me(); if (!m) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await m.admin.from('media_assets').select('id,kind,name,title,description,tags,url,width,height,bytes,status,uses,credit_earned,created_at').eq('designer_id', m.user.id).order('created_at', { ascending: false })
  if (error) return Response.json({ items: [], role: m.role, error: error.message })
  return Response.json({ items: data ?? [], role: m.role })
}

export async function POST(req: Request) {
  const m = await me(); if (!m) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (m.role !== 'designer' && m.role !== 'admin') return Response.json({ error: '디자이너로 승인된 회원만 올릴 수 있어요. 라이브러리 페이지에서 접수해 주세요.' }, { status: 403 })
  const fd = await req.formData().catch(() => null)
  if (!fd) return Response.json({ error: 'multipart 필요' }, { status: 400 })
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return Response.json({ error: '파일이 없어요' }, { status: 400 })
  const kindGiven = String(fd.get('kind') ?? '')
  const kind: MediaKind = (MEDIA_KINDS as readonly string[]).includes(kindGiven) ? (kindGiven as MediaKind) : 'other'
  const tags = String(fd.get('tags') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20)
  const description = String(fd.get('description') ?? '').trim().slice(0, 500) || null
  const items: unknown[] = []; const errors: string[] = []
  for (const file of files.slice(0, 10)) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) { errors.push(`${file.name}: 이미지/오디오만`); continue }
    if (file.size > MAX) { errors.push(`${file.name}: 8MB 초과`); continue }
    const raw = Buffer.from(await file.arrayBuffer())
    const opt = file.type.startsWith('image/') ? await optimizeImage(raw, file.type) : { buf: raw, mime: file.type, converted: false, width: null, height: null, from: raw.length }
    const ext = opt.converted ? 'webp' : ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin')
    const path = `${kind}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await m.admin.storage.from(BUCKET).upload(path, opt.buf, { contentType: opt.mime, upsert: false, cacheControl: '31536000' })
    if (upErr) { errors.push(`${file.name}: ${upErr.message}`); continue }
    const url = m.admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const base = file.name.replace(/\.[a-z0-9]+$/i, '')
    let name = toAssetName(base)
    for (let i = 0; i < 20; i++) { const { data: dup } = await m.admin.from('media_assets').select('id').eq('name', name).maybeSingle(); if (!dup) break; name = `${name.slice(0, 34)}_${Math.random().toString(36).slice(2, 6)}` }
    const row = { kind, name, title: base.slice(0, 80), description, genres: [] as string[], tags, path, url, mime: opt.mime, bytes: opt.buf.length, width: opt.width ?? null, height: opt.height ?? null, meta: opt.converted ? { original: { mime: file.type, bytes: opt.from } } : {}, auto_use: true, status: m.role === 'admin' ? 'active' : 'pending', created_by: m.user.id, designer_id: m.user.id }
    const { data, error } = await m.admin.from('media_assets').insert([row] as never).select('id,name,title,url,status').maybeSingle()
    if (error) { await m.admin.storage.from(BUCKET).remove([path]); errors.push(`${file.name}: ${error.message}`); continue }
    items.push(data)
  }
  return Response.json({ items, errors })
}
