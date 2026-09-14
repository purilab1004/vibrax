// 관리자 미디어 라이브러리 — 목록/검색, 업로드(다중), 수정(메타·이미지 교체·복제), 삭제
import { requireAdmin } from '@/lib/admin/guard'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/studio/templates'
import { MEDIA_KINDS, toAssetName, type MediaKind } from '@/lib/media/assets'
import { optimizeImage } from '@/lib/media/optimize'

export const runtime = 'nodejs'
const BUCKET = 'media'
const UPLOAD_MAX = 8_000_000  // 3D 모델·오디오까지 고려한 업로드 상한 (게임 주입은 ASSET_MAX_BYTES 이하만)
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/json'])

function kindOf(mime: string, given?: string | null): MediaKind {
  if (given && (MEDIA_KINDS as readonly string[]).includes(given)) return given as MediaKind
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('model/')) return 'model3d'
  if (mime.startsWith('font/')) return 'font'
  return 'other'
}
const splitList = (s: unknown) => (typeof s === 'string' ? s.split(',') : Array.isArray(s) ? s.map(String) : []).map(x => x.trim()).filter(Boolean).slice(0, 30)
const genreList = () => {
  const seen = new Set<string>(); const out: { slug: string; name: string; group?: string }[] = []
  for (const t of TEMPLATES) { if (seen.has(t.slug)) continue; seen.add(t.slug); out.push({ slug: t.slug, name: t.name, group: t.genreGroup }) }
  return out
}

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const u = new URL(req.url)
  const q = (u.searchParams.get('q') ?? '').trim().toLowerCase()
  const kind = u.searchParams.get('kind') ?? ''
  const genre = u.searchParams.get('genre') ?? ''
  const status = u.searchParams.get('status') ?? 'active'
  const page = Math.max(1, Number(u.searchParams.get('page') ?? 1)); const limit = Math.min(200, Math.max(1, Number(u.searchParams.get('limit') ?? 60)))
  let query = g.admin.from('media_assets').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)
  if (kind) query = query.eq('kind', kind)
  if (genre) query = query.contains('genres', [genre])
  if (q) query = query.or(`title.ilike.%${q}%,name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q.replace(/[{}",]/g, '')}}`)
  const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const { data: stats } = await g.admin.from('media_assets').select('kind,bytes,status')
  const byKind: Record<string, number> = {}; let totalBytes = 0; let archived = 0
  for (const r of (stats ?? []) as { kind: string; bytes: number; status: string }[]) { if (r.status === 'archived') { archived++; continue } byKind[r.kind] = (byKind[r.kind] ?? 0) + 1; totalBytes += r.bytes }
  return Response.json({ items: data ?? [], total: count ?? 0, page, limit, genres: genreList(), stats: { byKind, totalBytes, archived } })
}

async function uploadOne(g: { admin: SupabaseClient; user: { id: string } }, file: File, fields: { kind?: string | null; title?: string | null; name?: string | null; genres: string[]; tags: string[]; description?: string | null; width?: number | null; height?: number | null; meta?: Record<string, unknown>; auto_use?: boolean }) {
  const admin = g.admin
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED.has(mime) && !mime.startsWith('image/')) return { error: `지원하지 않는 형식: ${mime}` }
  if (file.size > UPLOAD_MAX) return { error: `${file.name}: 8MB 를 넘어요` }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const kind = kindOf(mime, fields.kind)
  // 키: 명시한 이름 > 제목(영문이면) > 파일명 — 제목에 background_basic 처럼 적으면 그게 그대로 코드 키가 된다
  const titleKey = fields.title ? toAssetName(fields.title) : ''
  let name = toAssetName(fields.name || (titleKey && titleKey !== 'asset' ? fields.title! : file.name))
  // 이름 충돌 시 접미사
  for (let i = 0; i < 20; i++) {
    const { data: dup } = await admin.from('media_assets').select('id').eq('name', name).maybeSingle()
    if (!dup) break
    name = `${name.slice(0, 34)}_${Math.random().toString(36).slice(2, 6)}`
  }
  // 이미지는 WebP 로 변환·축소 (로딩 속도·게임 주입 용량) — 애니 GIF·SVG 는 그대로
  const raw = Buffer.from(await file.arrayBuffer())
  const opt = mime.startsWith('image/') ? await optimizeImage(raw, mime) : { buf: raw, mime, ext, width: fields.width ?? null, height: fields.height ?? null, converted: false, from: raw.length }
  const buf = opt.buf; const outMime = opt.mime
  const path = `${kind}/${crypto.randomUUID()}.${opt.converted ? 'webp' : ext}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: outMime, upsert: false, cacheControl: '31536000' })
  if (upErr) return { error: `${file.name}: 업로드 실패 — ${upErr.message}` }
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const row = {
    kind, name, title: (fields.title || file.name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 80), description: fields.description?.slice(0, 500) || null,
    genres: fields.genres, tags: fields.tags, path, url, mime: outMime, bytes: buf.length, width: opt.width ?? fields.width ?? null, height: opt.height ?? fields.height ?? null,
    meta: { ...(fields.meta ?? {}), ...(opt.converted ? { original: { mime, bytes: opt.from } } : {}) }, auto_use: fields.auto_use ?? true, created_by: g.user.id,
  }
  const { data, error } = await admin.from('media_assets').insert([row] as never).select('*').maybeSingle()
  if (error) { await admin.storage.from(BUCKET).remove([path]); return { error: `${file.name}: ${error.message}` } }
  return { item: data }
}

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const fd = await req.formData().catch(() => null)
  if (!fd) return Response.json({ error: 'multipart 필요' }, { status: 400 })
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return Response.json({ error: '파일이 없어요' }, { status: 400 })
  const genres = splitList(fd.get('genres')); const tags = splitList(fd.get('tags'))
  const kind = (fd.get('kind') as string | null) || null
  const description = (fd.get('description') as string | null) || null
  const auto_use = fd.get('auto_use') !== '0'
  const role = (fd.get('role') as string | null) || null
  const dims: Record<string, { w: number; h: number }> = (() => { try { return JSON.parse(String(fd.get('dims') ?? '{}')) } catch { return {} } })()
  const items: unknown[] = []; const errors: string[] = []
  for (const f of files.slice(0, 30)) {
    const d = dims[f.name]
    const r = await uploadOne(g, f, { kind, genres, tags, description, width: d?.w ?? null, height: d?.h ?? null, auto_use, meta: role ? { role } : {}, title: files.length === 1 ? (fd.get('title') as string | null) : null, name: files.length === 1 ? (fd.get('name') as string | null) : null })
    if ('error' in r && r.error) errors.push(r.error); else items.push((r as { item: unknown }).item)
  }
  const saved = (items as { meta?: { original?: { bytes: number } }; bytes: number }[]).reduce((a, it) => a + Math.max(0, (it.meta?.original?.bytes ?? it.bytes) - it.bytes), 0)
  return Response.json({ items, errors, savedBytes: saved })
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const ct = req.headers.get('content-type') ?? ''
  // 이미지 교체 / 편집본 새로 저장 (multipart)
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    const id = String(fd.get('id') ?? ''); const file = fd.get('file'); const asNew = fd.get('asNew') === '1'
    if (!id || !(file instanceof File)) return Response.json({ error: 'id/file 필요' }, { status: 400 })
    const { data: cur } = await g.admin.from('media_assets').select('*').eq('id', id).maybeSingle()
    if (!cur) return Response.json({ error: 'not found' }, { status: 404 })
    const c = cur as { kind: string; name: string; title: string; description: string | null; genres: string[]; tags: string[]; path: string; meta: Record<string, unknown>; auto_use: boolean }
    const dims = (() => { try { return JSON.parse(String(fd.get('dims') ?? 'null')) as { w: number; h: number } | null } catch { return null } })()
    if (asNew) {
      const r = await uploadOne(g, file, { kind: c.kind, title: `${c.title} (편집)`, name: `${c.name}_v2`, genres: c.genres, tags: c.tags, description: c.description, width: dims?.w ?? null, height: dims?.h ?? null, meta: c.meta, auto_use: c.auto_use })
      if ('error' in r && r.error) return Response.json({ error: r.error }, { status: 400 })
      return Response.json({ item: (r as { item: unknown }).item })
    }
    const raw = Buffer.from(await file.arrayBuffer())
    if (raw.length > UPLOAD_MAX) return Response.json({ error: '8MB 초과' }, { status: 400 })
    const opt = await optimizeImage(raw, file.type || 'image/png')
    const path = `${c.kind}/${crypto.randomUUID()}.${opt.converted ? 'webp' : ((file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png')}`
    const { error: upErr } = await g.admin.storage.from(BUCKET).upload(path, opt.buf, { contentType: opt.mime, upsert: false, cacheControl: '31536000' })
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    const url = g.admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    const { data, error } = await g.admin.from('media_assets').update({ path, url, mime: opt.mime, bytes: opt.buf.length, width: opt.width ?? dims?.w ?? null, height: opt.height ?? dims?.h ?? null, updated_at: new Date().toISOString() } as never).eq('id', id).select('*').maybeSingle()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await g.admin.storage.from(BUCKET).remove([c.path]).catch(() => null)
    return Response.json({ item: data })
  }
  // 메타 수정 (JSON) — 여러 개 동시(ids) 지원
  const b = await req.json().catch(() => null) as { id?: string; ids?: string[]; title?: string; name?: string; description?: string | null; kind?: string; genres?: string[]; tags?: string[]; meta?: Record<string, unknown>; auto_use?: boolean; status?: string; addGenres?: string[]; addTags?: string[] } | null
  const ids = b?.ids?.length ? b.ids : b?.id ? [b.id] : []
  if (!ids.length) return Response.json({ error: 'id 필요' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b?.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 80)
  if (typeof b?.name === 'string' && b.name.trim() && ids.length === 1) patch.name = toAssetName(b.name)
  if (b && 'description' in b) patch.description = b.description ? String(b.description).slice(0, 500) : null
  if (b?.kind && (MEDIA_KINDS as readonly string[]).includes(b.kind)) patch.kind = b.kind
  if (Array.isArray(b?.genres)) patch.genres = splitList(b!.genres)
  if (Array.isArray(b?.tags)) patch.tags = splitList(b!.tags)
  if (b?.meta && typeof b.meta === 'object') patch.meta = b.meta
  if (typeof b?.auto_use === 'boolean') patch.auto_use = b.auto_use
  if (b?.status === 'active' || b?.status === 'archived') patch.status = b.status
  // 태그·장르 추가(일괄)
  if (Array.isArray(b?.addGenres) || Array.isArray(b?.addTags)) {
    const { data: rows } = await g.admin.from('media_assets').select('id,genres,tags').in('id', ids)
    for (const r of (rows ?? []) as { id: string; genres: string[]; tags: string[] }[]) {
      const p2 = { ...patch, genres: [...new Set([...r.genres, ...splitList(b!.addGenres ?? [])])], tags: [...new Set([...r.tags, ...splitList(b!.addTags ?? [])])] }
      await g.admin.from('media_assets').update(p2 as never).eq('id', r.id)
    }
    return Response.json({ ok: true })
  }
  const { data, error } = await g.admin.from('media_assets').update(patch as never).in('id', ids).select('*')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { ids?: string[] } | null
  const ids = (b?.ids ?? []).filter(x => typeof x === 'string').slice(0, 200)
  if (!ids.length) return Response.json({ error: 'ids 필요' }, { status: 400 })
  const { data: rows } = await g.admin.from('media_assets').select('id,path').in('id', ids)
  const paths = ((rows ?? []) as { path: string }[]).map(r => r.path)
  if (paths.length) await g.admin.storage.from(BUCKET).remove(paths).catch(() => null)
  const { error } = await g.admin.from('media_assets').delete().in('id', ids)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, deleted: ids.length })
}
