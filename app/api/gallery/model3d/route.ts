// /api/gallery/model3d — 3D 모델 생성 (스튜디오 › 디자이너 AI) · Modal GPU 서버리스 TRELLIS (scripts/modal/trellis3d.py)
// POST { mode:'image'|'text'|'media'|'drive', image?: dataURL, prompt?, assetId?, driveKey?, title? } → 프롬코인 차감 → Modal 제출 → { token }
// GET ?token=  → 진행 상태. 완성되면 GLB·썸네일을 임시 보관(model3d/tmp/<rid>)하고 { status:'done', preview:{url,thumb} }
// POST { action:'save', token, folder?, title? } → 디자이너 드라이브에 저장 / { action:'discard', token } → 임시 파일 삭제
// 실패·시간 초과면 차감한 프롬코인을 돌려준다.
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET, root, dec, folderPath, cleanName, requireDesigner, freeKey } from '@/lib/designer/drive'
import { modalReady, modalSubmit, modalStatus, modalFile, signToken, verifyToken } from '@/lib/modal/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const SALT = 'vibrex-model3d'
const DEFAULT_COST = 3                              // Modal 원가 한 개 약 $0.01~0.02
interface Tok { u: string; rid: string; ref: string; cost: number; mode: string; title: string; prompt: string; at: number }
const tmpId = (rid: string) => rid.replace(/[^\w-]/g, '')
const tmp = (rid: string) => `model3d/tmp/${tmpId(rid)}`

async function costOf() {
  const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'model3d_cost').maybeSingle()
  const c = Number((data as { value?: unknown } | null)?.value)
  return Number.isFinite(c) && c >= 0 ? c : DEFAULT_COST
}

export async function POST(req: Request) {
  const g = await requireDesigner(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null) as { action?: string; token?: string; folder?: string; mode?: string; image?: string; prompt?: string; assetId?: string; driveKey?: string; title?: string } | null
  const store = g.admin.storage.from(BUCKET)

  // 저장 / 버리기
  if (body?.action === 'save' || body?.action === 'discard') {
    const t = verifyToken<Tok>(SALT, String(body.token ?? ''))
    if (!t || t.u !== g.user.id) return Response.json({ error: 'bad token' }, { status: 400 })
    const base = tmp(t.rid)
    if (body.action === 'discard') { await store.remove([`${base}.glb`, `${base}.png`]); return Response.json({ ok: true }) }
    const title = cleanName(String(body.title ?? '') || t.title || '3D 모델', 60)
    const { key, name } = await freeKey(g.admin, folderPath(g.user.id, cleanName(String(body.folder ?? ''), 40) || '3D 모델'), title + '.glb')
    const { error } = await store.move(`${base}.glb`, key)
    if (error) return Response.json({ error: /not.?found/i.test(error.message) ? '이미 저장했거나 버린 모델이에요' : error.message }, { status: 400 })
    await store.move(`${base}.png`, key + '.t').catch(() => null)
    return Response.json({ ok: true, key, name, url: store.getPublicUrl(key).data.publicUrl })
  }

  if (!modalReady()) return Response.json({ error: '3D 생성 서버가 아직 준비되지 않았어요' }, { status: 503 })
  const mode = body?.mode === 'text' ? 'text' : body?.mode === 'media' ? 'media' : body?.mode === 'drive' ? 'drive' : 'image'
  const prompt = (body?.prompt ?? '').trim().slice(0, 200)
  let title = cleanName(body?.title ?? '', 60)
  let payload: Record<string, unknown>
  if (mode === 'text') {
    if (!prompt) return Response.json({ error: '만들 3D 모델을 글로 설명해 주세요' }, { status: 400 })
    payload = { mode: 'text', prompt }; title ||= prompt.slice(0, 40)
  } else if (mode === 'media') {
    const { data: a } = await g.admin.from('media_assets').select('url,title,kind').eq('id', String(body?.assetId ?? '')).eq('status', 'active').maybeSingle()
    const row = a as { url: string; title: string; kind: string } | null
    if (!row || row.kind === 'audio' || row.kind === 'model3d') return Response.json({ error: '이미지 에셋을 골라 주세요' }, { status: 400 })
    payload = { mode: 'image', image_url: row.url }; title ||= row.title
  } else if (mode === 'drive') {
    const k = String(body?.driveKey ?? ''), fname = dec(k.split('/').pop() ?? '')
    if (!k.startsWith(root(g.user.id) + '/') || k.includes('..') || !/\.(png|jpe?g|webp|gif)$/i.test(fname)) return Response.json({ error: '드라이브의 이미지를 골라 주세요' }, { status: 400 })
    payload = { mode: 'image', image_url: store.getPublicUrl(k).data.publicUrl }; title ||= fname.replace(/\.[a-z0-9]+$/i, '')
  } else {
    const img = String(body?.image ?? '')
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(img)) return Response.json({ error: 'PNG·JPG·WEBP 이미지를 올려 주세요' }, { status: 400 })
    if (img.length > 4_000_000) return Response.json({ error: '이미지가 너무 커요' }, { status: 400 })
    payload = { mode: 'image', image_b64: img.slice(img.indexOf(',') + 1) }; title ||= '3D 모델'
  }

  const cost = await costOf()
  const ref = `m3d:${crypto.randomUUID()}`
  if (cost > 0) {
    const { error } = await g.supabase.rpc('spend_credits', { p_amount: cost, p_ref: ref } as never)
    if (error) {
      const insufficient = error.message.includes('INSUFFICIENT_CREDITS')
      return Response.json({ error: insufficient ? `프롬코인이 부족해요 (${cost} 필요)` : '결제 실패' }, { status: insufficient ? 402 : 500 })
    }
  }
  const refund = async () => { if (cost > 0) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: cost, p_ref: ref } as never) }
  try {
    const r = await modalSubmit(payload)
    if (!r.ok || !r.id) { await refund(); return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: r.detail }, { status: 502 }) }
    return Response.json({ token: signToken<Tok>(SALT, { u: g.user.id, rid: r.id, ref, cost, mode, title, prompt, at: Date.now() }), cost })
  } catch (e) {
    await refund()
    return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: String((e as Error).message) }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get('info')) return Response.json({ cost: await costOf(), ready: modalReady() })
  const g = await requireDesigner(); if ('error' in g) return g.error
  const t = verifyToken<Tok>(SALT, u.searchParams.get('token') ?? '')
  if (!t || t.u !== g.user.id) return Response.json({ error: 'bad token' }, { status: 400 })
  const store = g.admin.storage.from(BUCKET)
  const base = tmp(t.rid)
  const preview = (thumb: boolean) => ({ url: store.getPublicUrl(`${base}.glb`).data.publicUrl, thumb: thumb ? store.getPublicUrl(`${base}.png`).data.publicUrl : null, title: t.title })

  // 이미 받아 둔 경우 (새로고침·중복 호출)
  const { data: have } = await store.list('model3d/tmp', { search: tmpId(t.rid) })
  if ((have ?? []).some((f) => f.name === `${tmpId(t.rid)}.glb`)) return Response.json({ status: 'done', preview: preview((have ?? []).some((f) => f.name === `${tmpId(t.rid)}.png`)) })

  const elapsed = Math.round((Date.now() - t.at) / 1000)
  const s = await modalStatus(t.rid)
  const refundOnce = async (why: string) => {
    if (t.cost > 0) {
      const { data: already } = await g.admin.from('credit_ledger').select('id').eq('user_id', g.user.id).eq('ref_id', t.ref).gt('amount', 0).limit(1)
      if (!(already ?? []).length) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: t.cost, p_ref: t.ref } as never)
    }
    return Response.json({ status: 'failed', error: why + (t.cost > 0 ? ' — 프롬코인은 돌려드렸어요' : '') })
  }
  if (s?.status === 'failed') return refundOnce('3D 모델을 만들지 못했어요')
  if (s?.status !== 'done') {
    if (Date.now() - t.at > 20 * 60_000) return refundOnce('3D 생성이 너무 오래 걸려 취소했어요')
    return Response.json({ status: 'running', elapsed })
  }
  const glb = await modalFile(t.rid, 'glb')
  if (!glb) return Response.json({ status: 'running', elapsed })
  // 썸네일 먼저 — glb 가 있으면 '완료'로 보므로
  let thumb = false
  if (s.thumb) { const tb = await modalFile(t.rid, 'thumb'); if (tb) thumb = !(await store.upload(`${base}.png`, tb, { contentType: 'image/png', upsert: true })).error }
  const up = await store.upload(`${base}.glb`, glb, { contentType: 'model/gltf-binary', upsert: true })
  if (up.error) return Response.json({ status: 'running', elapsed, note: up.error.message })
  return Response.json({ status: 'done', preview: preview(thumb) })
}
