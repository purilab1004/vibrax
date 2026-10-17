// /api/designer/drive — 디자이너 드라이브 (스튜디오 › 디자인 AI)
// GET ?folder=        → { folders, files } (폴더는 한 단계)
// POST { action, … }  → upload_url(직접 업로드용 서명 URL) · mkdir · rmdir · delete · rename · move · save_image(AI 생성 이미지 저장) · publish(갤러리 공개 신청)
import { glbRig, RIG_MARK, BUCKET, dec, root, folderPath, cleanName, extOf, mimeOf, DRIVE_EXT, requireDesigner, freeKey } from '@/lib/designer/drive'
import { modalFile, verifyToken, type ImageTok } from '@/lib/modal/client'
import { MEDIA_KINDS, toAssetName, type MediaKind } from '@/lib/media/assets'

export const runtime = 'nodejs'
export const maxDuration = 60

interface FileOut { key: string; name: string; url: string; thumb: string | null; size: number; mime: string; created_at: string | null; rig?: 'face' | 'anim' | 'bones' | 'none' | null }

export async function GET(req: Request) {
  const g = await requireDesigner(); if ('error' in g) return g.error
  const folder = cleanName(new URL(req.url).searchParams.get('folder') ?? '')
  const store = g.admin.storage.from(BUCKET)
  const dir = folderPath(g.user.id, folder)
  const { data, error } = await store.list(dir, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const names = new Set((data ?? []).map((f) => f.name))
  const pub = (k: string) => store.getPublicUrl(k).data.publicUrl
  const folders: { name: string }[] = []
  const files: FileOut[] = []
  for (const f of data ?? []) {
    if (!f.id) { if (!folder) folders.push({ name: dec(f.name) }); continue }  // 폴더
    if (f.name === '.keep' || f.name.endsWith('.t') || f.name.endsWith(RIG_MARK)) continue
    const key = `${dir}/${f.name}`
    files.push({ key, name: dec(f.name), url: pub(key), thumb: names.has(f.name + '.t') ? pub(key + '.t') : null, size: Number((f.metadata as { size?: number } | null)?.size ?? 0), mime: String((f.metadata as { mimetype?: string } | null)?.mimetype ?? mimeOf(dec(f.name))), created_at: f.created_at ?? null })
  }
  // 3D 모델: 뼈대·움직임 여부 (표식이 없으면 GLB 앞부분을 읽어 확인하고 표식을 남긴다)
  await Promise.all(files.filter((f) => /\.glb$/i.test(f.name)).map(async (f) => {
    const base = f.key.split('/').pop()!
    const mark = (data ?? []).find((x) => x.name === base + RIG_MARK)
    if (mark) { const r = await store.download(f.key + RIG_MARK).then((x) => x.data?.text()).catch(() => null); f.rig = (r as FileOut['rig']) ?? null; return }
    f.rig = await glbRig(f.url)
    if (f.rig) await store.upload(f.key + RIG_MARK, Buffer.from(f.rig), { contentType: 'text/plain', upsert: true })
  }))
  folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return Response.json({ folder, folders, files })
}

export async function POST(req: Request) {
  const g = await requireDesigner(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })
  const uid = g.user.id, store = g.admin.storage.from(BUCKET)
  const mine = (k: unknown): k is string => typeof k === 'string' && k.startsWith(root(uid) + '/') && !k.includes('..')
  const folder = cleanName(String(body.folder ?? ''), 40)

  switch (body.action) {
    case 'upload_url': {
      const name = cleanName(String(body.name ?? ''))
      if (!DRIVE_EXT.includes(extOf(name))) return Response.json({ error: '이미지(PNG·JPG·WEBP·GIF)·GLB·오디오만 올릴 수 있어요' }, { status: 400 })
      const { key, name: n } = await freeKey(g.admin, folderPath(uid, folder), name)
      const { data, error } = await store.createSignedUploadUrl(key)
      if (error || !data) return Response.json({ error: error?.message ?? '업로드 URL 실패' }, { status: 500 })
      return Response.json({ key, name: n, path: data.path, token: data.token })
    }
    case 'mkdir': {
      if (!folder) return Response.json({ error: '폴더 이름을 적어 주세요' }, { status: 400 })
      const { error } = await store.upload(`${folderPath(uid, folder)}/.keep`, Buffer.from(''), { contentType: 'text/plain', upsert: true })
      return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true })
    }
    case 'rmdir': {
      if (!folder) return Response.json({ error: 'bad folder' }, { status: 400 })
      const dir = folderPath(uid, folder)
      const { data } = await store.list(dir, { limit: 1000 })
      const keys = (data ?? []).map((f) => `${dir}/${f.name}`)
      if (keys.length) await store.remove(keys)
      return Response.json({ ok: true, removed: keys.length })
    }
    case 'delete': {
      const keys = (Array.isArray(body.keys) ? body.keys : []).filter(mine).slice(0, 200)
      if (!keys.length) return Response.json({ error: '지울 파일이 없어요' }, { status: 400 })
      const { error } = await store.remove([...keys, ...keys.map((k) => k + '.t'), ...keys.map((k) => k + RIG_MARK)])
      return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true })
    }
    case 'rename':
    case 'move': {
      const keys = (body.action === 'rename' ? [body.key] : Array.isArray(body.keys) ? body.keys : []).filter(mine).slice(0, 200)
      if (!keys.length) return Response.json({ error: 'bad key' }, { status: 400 })
      const out: string[] = []
      for (const k of keys) {
        const oldName = dec(k.split('/').pop()!)
        let newName = oldName
        if (body.action === 'rename') {
          newName = cleanName(String(body.name ?? ''))
          if (!newName) return Response.json({ error: '이름을 적어 주세요' }, { status: 400 })
          if (extOf(newName) !== extOf(oldName)) newName += '.' + extOf(oldName)
        }
        const dir = body.action === 'rename' ? k.slice(0, k.lastIndexOf('/')) : folderPath(uid, folder)
        const { key: to } = await freeKey(g.admin, dir, newName)
        const { error } = await store.move(k, to)
        if (error) return Response.json({ error: error.message }, { status: 500 })
        await store.move(k + '.t', to + '.t').catch(() => null)   // 썸네일(있으면)
        await store.move(k + RIG_MARK, to + RIG_MARK).catch(() => null)
        out.push(to)
      }
      return Response.json({ ok: true, keys: out })
    }
    case 'save_image': {
      // AI 이미지 생성 결과(Modal) 중 고른 것을 드라이브에 저장
      const t = verifyToken<ImageTok>('vibrex-image', String(body.token ?? ''))
      const idx = Number(body.index)
      if (!t || t.u !== uid || !Number.isInteger(idx) || idx < 0 || idx > 3) return Response.json({ error: 'bad token' }, { status: 400 })
      const buf = await modalFile(t.rid, `img${idx}`)
      if (!buf) return Response.json({ error: '이미지를 찾지 못했어요 (오래되면 사라져요)' }, { status: 404 })
      const base = cleanName(String(body.name ?? '') || t.prompt.slice(0, 30) || 'AI 이미지', 60)
      const { key, name } = await freeKey(g.admin, folderPath(uid, folder || 'AI 이미지'), base + '.webp')
      const { error } = await store.upload(key, buf, { contentType: 'image/webp', cacheControl: '31536000' })
      return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true, key, name, url: store.getPublicUrl(key).data.publicUrl })
    }
    case 'publish': {
      // 드라이브 파일 → 미디어 라이브러리(갤러리) 공개 신청. 디자이너는 승인 대기, 관리자는 바로 공개
      const k = body.key
      if (!mine(k)) return Response.json({ error: 'bad key' }, { status: 400 })
      const fname = dec(k.split('/').pop()!), ext = extOf(fname), mime = mimeOf(fname)
      const is3d = ext === 'glb'
      const kindGiven = String(body.kind ?? '')
      const kind: MediaKind = is3d ? 'model3d' as MediaKind : mime.startsWith('audio/') ? 'audio' as MediaKind : (MEDIA_KINDS as readonly string[]).includes(kindGiven) ? kindGiven as MediaKind : 'other' as MediaKind
      const id = crypto.randomUUID(), path = `${kind}/${id}.${ext}`
      const { error: cpErr } = await store.copy(k, path)
      if (cpErr) return Response.json({ error: cpErr.message }, { status: 500 })
      let thumb: string | null = null
      if (is3d && !(await store.copy(k + '.t', `${kind}/${id}.png`)).error) thumb = store.getPublicUrl(`${kind}/${id}.png`).data.publicUrl
      const title = cleanName(String(body.title ?? '') || fname.replace(/\.[a-z0-9]+$/i, ''), 80)
      let name = toAssetName(title)
      for (let i = 0; i < 20; i++) { const { data: dup } = await g.admin.from('media_assets').select('id').eq('name', name).maybeSingle(); if (!dup) break; name = `${name.slice(0, 34)}_${Math.random().toString(36).slice(2, 6)}` }
      const { data: info } = await store.info(path).catch(() => ({ data: null }))
      const rig = is3d ? await glbRig(store.getPublicUrl(k).data.publicUrl) : null
      const row = {
        kind, name, title, description: String(body.description ?? '').trim().slice(0, 500) || null, genres: [] as string[],
        tags: String(body.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20), path, url: store.getPublicUrl(path).data.publicUrl,
        mime, bytes: Number((info as { size?: number } | null)?.size ?? 0), width: null, height: null, meta: { drive_key: k, ...(thumb ? { thumb } : {}), ...(rig ? { rig } : {}) },
        auto_use: !is3d, status: g.role === 'admin' ? 'active' : 'pending', created_by: uid, designer_id: uid,
      }
      const { data, error } = await g.admin.from('media_assets').insert([row] as never).select('id,name,title,status').maybeSingle()
      if (error) { await store.remove([path]); return Response.json({ error: error.message }, { status: 500 }) }
      return Response.json({ ok: true, asset: data })
    }
  }
  return Response.json({ error: 'unknown action' }, { status: 400 })
}

