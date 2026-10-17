// /api/designer/rig — 드라이브의 3D 모델(GLB)에 뼈대를 넣는다 (Modal UniRig 자동 리깅)
// POST { key } → 프롬코인 차감 → Modal 제출 → { token }
// GET ?token= → { status:'running' } | { status:'done', key, name, url }(드라이브에 '<이름> (움직임).glb' 로 저장) | { status:'failed' }(환불)
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET, root, dec, cleanName, freeKey, requireDesigner } from '@/lib/designer/drive'
import { modalReady, modalSubmit, modalStatus, modalFile, signToken, verifyToken } from '@/lib/modal/client'

export const runtime = 'nodejs'
export const maxDuration = 60
const SALT = 'vibrex-rig'
const DEFAULT_COST = 3   // A10G 약 1~2분
interface Tok { u: string; rid: string; ref: string; cost: number; key: string; at: number }

async function costOf() {
  const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'rig_cost').maybeSingle()
  const c = Number((data as { value?: unknown } | null)?.value)
  return Number.isFinite(c) && c >= 0 ? c : DEFAULT_COST
}

export async function POST(req: Request) {
  const g = await requireDesigner(); if ('error' in g) return g.error
  if (!modalReady()) return Response.json({ error: '리깅 서버가 아직 준비되지 않았어요' }, { status: 503 })
  const body = await req.json().catch(() => null) as { key?: string } | null
  const key = String(body?.key ?? '')
  if (!key.startsWith(root(g.user.id) + '/') || key.includes('..') || !/\.glb$/i.test(dec(key.split('/').pop() ?? ''))) return Response.json({ error: '드라이브의 3D 모델(GLB)을 골라 주세요' }, { status: 400 })
  const cost = await costOf()
  const ref = `rig:${crypto.randomUUID()}`
  if (cost > 0) {
    const { error } = await g.supabase.rpc('spend_credits', { p_amount: cost, p_ref: ref } as never)
    if (error) {
      const insufficient = error.message.includes('INSUFFICIENT_CREDITS')
      return Response.json({ error: insufficient ? `프롬코인이 부족해요 (${cost} 필요)` : '결제 실패' }, { status: insufficient ? 402 : 500 })
    }
  }
  const r = await modalSubmit({ mode: 'rig', glb_url: g.admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl }).catch(() => ({ ok: false, id: undefined }))
  if (!r.ok || !r.id) {
    if (cost > 0) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: cost, p_ref: ref } as never)
    return Response.json({ error: '리깅 요청 실패 — 프롬코인은 돌려드렸어요' }, { status: 502 })
  }
  return Response.json({ token: signToken<Tok>(SALT, { u: g.user.id, rid: r.id, ref, cost, key, at: Date.now() }), cost })
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get('info')) return Response.json({ cost: await costOf(), ready: modalReady() })
  const g = await requireDesigner(); if ('error' in g) return g.error
  const t = verifyToken<Tok>(SALT, u.searchParams.get('token') ?? '')
  if (!t || t.u !== g.user.id) return Response.json({ error: 'bad token' }, { status: 400 })
  const store = g.admin.storage.from(BUCKET)
  const dir = t.key.slice(0, t.key.lastIndexOf('/'))
  const base = dec(t.key.split('/').pop()!).replace(/\.glb$/i, '')
  const outName = `${base} (움직임).glb`
  const refund = async (why: string) => {
    if (t.cost > 0) {
      const { data: already } = await g.admin.from('credit_ledger').select('id').eq('user_id', g.user.id).eq('ref_id', t.ref).gt('amount', 0).limit(1)
      if (!(already ?? []).length) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: t.cost, p_ref: t.ref } as never)
    }
    return Response.json({ status: 'failed', error: why + (t.cost > 0 ? ' — 프롬코인은 돌려드렸어요' : '') })
  }
  const s = await modalStatus(t.rid)
  const elapsed = Math.round((Date.now() - t.at) / 1000)
  if (s?.status === 'failed') return refund('뼈대를 넣지 못했어요(모양이 복잡하거나 사람·동물 형태가 아닐 수 있어요)')
  if (s?.status !== 'done') {
    if (Date.now() - t.at > 20 * 60_000) return refund('너무 오래 걸려 취소했어요')
    return Response.json({ status: 'running', elapsed })
  }
  // 이미 저장했으면 그대로 (같은 토큰으로 다시 물어볼 때) — 요청 뒤에 생긴 같은 이름 파일
  const { data: list } = await store.list(dir, { limit: 1000 })
  const done = (list ?? []).find((f) => f.id && dec(f.name) === outName && f.name.indexOf('.') < 0 && new Date(f.created_at ?? 0).getTime() > t.at)
  if (done) { const k = `${dir}/${done.name}`; return Response.json({ status: 'done', key: k, name: outName, url: store.getPublicUrl(k).data.publicUrl }) }
  const glb = await modalFile(t.rid, 'glb')
  if (!glb) return Response.json({ status: 'running', elapsed })
  const { key, name } = await freeKey(g.admin, dir, cleanName(outName, 90))
  const up = await store.upload(key, glb, { contentType: 'model/gltf-binary' })
  if (up.error) return Response.json({ status: 'running', elapsed, note: up.error.message })
  await store.copy(t.key + '.t', key + '.t').catch(() => null)   // 원본 썸네일을 같이
  // 이 원본으로 갤러리에 공개한 3D 모델이 있으면 파일을 움직이는 버전으로 바꾼다 → 그 모델을 쓰는 게임도 그대로 움직인다
  let updated = 0
  const { data: pubs } = await g.admin.from('media_assets').select('id,path,meta').eq('kind', 'model3d').eq('designer_id', g.user.id).eq('meta->>drive_key', t.key)
  for (const a of (pubs ?? []) as { id: string; path: string | null; meta: Record<string, unknown> | null }[]) {
    if (!a.path) continue
    const { error } = await store.upload(a.path, glb, { contentType: 'model/gltf-binary', upsert: true, cacheControl: '60' })
    if (!error) { await g.admin.from('media_assets').update({ bytes: glb.length, meta: { ...(a.meta ?? {}), rigged: true, drive_key: key } } as never).eq('id', a.id); updated++ }
  }
  return Response.json({ status: 'done', key, name, url: store.getPublicUrl(key).data.publicUrl, updatedPublished: updated })
}
