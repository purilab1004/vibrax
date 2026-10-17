// /api/media/upload-glb — 회원이 자기 3D 모델(GLB)을 올려 자기 게임에 쓴다 (스튜디오 미디어 선택기 › 3D 모델)
// POST { action:'url', name, size }        → 스토리지 직접 업로드용 서명 URL (Vercel 본문 4.5MB 제한을 피해서)
// POST { action:'done', path, title }      → GLB 확인(머리 'glTF'·크기) → 뼈대·움직임 여부 → 미디어 에셋 등록(갤러리엔 안 보임: visibility 'admin' + 본인만 선택기에서)
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toAssetName } from '@/lib/media/assets'
import { glbRig, cleanName } from '@/lib/designer/drive'

export const runtime = 'nodejs'
const BUCKET = 'media'
const MAX = 30_000_000

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: '로그인이 필요해요' }, { status: 401 })
  const body = await req.json().catch(() => null) as { action?: string; name?: string; size?: number; path?: string; title?: string } | null
  const admin = createAdminClient()
  const store = admin.storage.from(BUCKET)
  const dir = `model3d/user/${user.id}`

  if (body?.action === 'url') {
    if (!/\.glb$/i.test(String(body.name ?? ''))) return Response.json({ error: 'GLB 파일만 올릴 수 있어요 (.glb)' }, { status: 400 })
    if (Number(body.size) > MAX) return Response.json({ error: '30MB 이하의 GLB 만 올릴 수 있어요' }, { status: 400 })
    const { count } = await admin.from('media_assets').select('id', { count: 'exact', head: true }).eq('designer_id', user.id).like('path', `${dir}/%`)
    if ((count ?? 0) >= 50) return Response.json({ error: '올린 3D 모델이 50개를 넘었어요. 안 쓰는 모델을 지워 주세요.' }, { status: 400 })
    const path = `${dir}/${crypto.randomUUID()}.glb`
    const { data, error } = await store.createSignedUploadUrl(path)
    if (error || !data) return Response.json({ error: error?.message ?? '업로드 준비 실패' }, { status: 500 })
    return Response.json({ path: data.path, token: data.token })
  }

  if (body?.action === 'done') {
    const path = String(body.path ?? '')
    if (!path.startsWith(dir + '/') || path.includes('..') || !path.endsWith('.glb')) return Response.json({ error: 'bad path' }, { status: 400 })
    const url = store.getPublicUrl(path).data.publicUrl
    const head = await fetch(url, { headers: { Range: 'bytes=0-11' } }).catch(() => null)
    const hb = head?.ok ? Buffer.from(await head.arrayBuffer()) : null
    if (!hb || hb.toString('ascii', 0, 4) !== 'glTF') { await store.remove([path]); return Response.json({ error: '올바른 GLB 파일이 아니에요' }, { status: 400 }) }
    const size = hb.length >= 12 ? hb.readUInt32LE(8) : 0
    if (size > MAX) { await store.remove([path]); return Response.json({ error: '30MB 이하의 GLB 만 올릴 수 있어요' }, { status: 400 }) }
    const rig = await glbRig(url)
    const title = cleanName(String(body.title ?? '') || '내 3D 모델', 60).replace(/\.glb$/i, '')
    let name = toAssetName('my_' + title)
    if (name.replace(/^my_?/, '').length < 2) name = `my_model_${Math.random().toString(36).slice(2, 7)}`   // 한글 이름은 코드 키가 비므로
    for (let i = 0; i < 20; i++) { const { data: dup } = await admin.from('media_assets').select('id').eq('name', name).maybeSingle(); if (!dup) break; name = `${name.slice(0, 32)}_${Math.random().toString(36).slice(2, 6)}` }
    const row = {
      kind: 'model3d', name, title, description: null, genres: [] as string[], tags: ['upload'], path, url, mime: 'model/gltf-binary', bytes: size,
      width: null, height: null, meta: { uploaded: true, ...(rig ? { rig } : {}) },
      auto_use: false, status: 'active', visibility: 'admin', created_by: user.id, designer_id: user.id, credit_cost: 0,
    }
    const { data, error } = await admin.from('media_assets').insert([row] as never).select('id,kind,name,title,url,meta').maybeSingle()
    if (error) { await store.remove([path]); return Response.json({ error: error.message }, { status: 500 }) }
    return Response.json({ ok: true, asset: data })
  }
  return Response.json({ error: 'bad request' }, { status: 400 })
}
