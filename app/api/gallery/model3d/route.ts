// /api/gallery/model3d — 갤러리 3D 생성기
//   기본: Modal GPU 서버리스의 TRELLIS (scripts/modal/trellis3d.py · MODAL_3D_URL/MODAL_3D_TOKEN)
//   예비: fal.ai Hunyuan3D v3.1 Rapid (FAL_KEY) — Modal 설정이 없을 때만
// POST { mode:'image'|'text'|'media', image?: dataURL, prompt?, assetId?, pbr?, title? } → 프롬코인 차감 → fal 대기열에 제출 → { token }
// GET ?token=… → 진행 상태. 완성되면 GLB·썸네일을 스토리지에 올리고 미디어 라이브러리(3D 모델)에 등록 → { status:'done', asset }
//     실패하면 차감한 프롬코인을 돌려준다. token 은 서버 비밀값으로 서명(요청자·요청 id·차감 내역) — 별도 테이블 없이 상태를 들고 다닌다
// GET ?mine=1 → 내가 만든 3D 모델 목록
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toAssetName } from '@/lib/media/assets'

export const runtime = 'nodejs'
export const maxDuration = 60

const FAL = 'https://queue.fal.run'
const APP = 'fal-ai/hunyuan-3d/v3.1/rapid'
const BUCKET = 'media'
const DEFAULT_COST = 10, PBR_EXTRA = 5            // 프롬코인 (fal 원가 약 $0.225 · PBR +$0.15)
const MODAL_COST = 3                               // Modal 원가 한 개 약 $0.01 — 남용만 막는 값
const MODAL = () => (process.env.MODAL_3D_URL ?? '').replace(/\/$/, '')
const modalHeaders = () => ({ Authorization: `Bearer ${process.env.MODAL_3D_TOKEN}`, 'Content-Type': 'application/json' })

interface Tok { p?: 'modal' | 'fal'; u: string; rid: string; st: string; rs: string; ref: string; cost: number; mode: string; title: string; prompt: string; pbr: boolean; at: number }
const secret = () => createHmac('sha256', 'vibrex-model3d').update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').digest()
const sign = (t: Tok) => { const b = Buffer.from(JSON.stringify(t)).toString('base64url'); return b + '.' + createHmac('sha256', secret()).update(b).digest('base64url') }
function verify(token: string): Tok | null {
  const [b, s] = token.split('.')
  if (!b || !s) return null
  const want = createHmac('sha256', secret()).update(b).digest()
  const got = Buffer.from(s, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()) as Tok } catch { return null }
}
const falHeaders = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' })

async function costOf(pbr: boolean, modal: boolean) {
  const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'model3d_cost').maybeSingle()
  const c = Number((data as { value?: unknown } | null)?.value)
  if (modal) return Number.isFinite(c) && c >= 0 ? c : MODAL_COST
  return (Number.isFinite(c) && c >= 1 ? c : DEFAULT_COST) + (pbr ? PBR_EXTRA : 0)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: '로그인이 필요해요' }, { status: 401 })
  const useModal = !!(MODAL() && process.env.MODAL_3D_TOKEN)
  if (!useModal && !process.env.FAL_KEY) return Response.json({ error: '3D 생성기가 아직 준비되지 않았어요 (관리자: MODAL_3D_URL 설정 필요)' }, { status: 503 })
  const body = await req.json().catch(() => null) as { mode?: string; image?: string; prompt?: string; assetId?: string; pbr?: boolean; title?: string } | null
  const mode = body?.mode === 'text' ? 'text' : body?.mode === 'media' ? 'media' : 'image'
  const prompt = (body?.prompt ?? '').trim().slice(0, 200)
  const pbr = !useModal && body?.pbr === true
  let input: Record<string, unknown>, endpoint: string, title = (body?.title ?? '').trim().slice(0, 60)
  if (mode === 'text') {
    if (!prompt) return Response.json({ error: '만들 3D 모델을 글로 설명해 주세요' }, { status: 400 })
    endpoint = `${APP}/text-to-3d`; input = { prompt, enable_pbr: pbr }; title ||= prompt.slice(0, 40)
  } else {
    let url = ''
    if (mode === 'media') {
      const { data: a } = await createAdminClient().from('media_assets').select('url,title,kind').eq('id', String(body?.assetId ?? '')).eq('status', 'active').maybeSingle()
      const row = a as { url: string; title: string; kind: string } | null
      if (!row || row.kind === 'audio' || row.kind === 'model3d') return Response.json({ error: '이미지 에셋을 골라 주세요' }, { status: 400 })
      url = row.url; title ||= row.title
    } else {
      const img = String(body?.image ?? '')
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(img)) return Response.json({ error: 'PNG·JPG·WEBP 이미지를 올려 주세요' }, { status: 400 })
      if (img.length > 8_000_000) return Response.json({ error: '이미지가 너무 커요 (6MB 이하)' }, { status: 400 })
      url = img; title ||= '3D 모델'
    }
    endpoint = `${APP}/image-to-3d`; input = { input_image_url: url, enable_pbr: pbr }
  }

  const cost = await costOf(pbr, useModal)
  const ref = `m3d:${crypto.randomUUID()}`
  const { error: spendErr } = cost > 0 ? await supabase.rpc('spend_credits', { p_amount: cost, p_ref: ref } as never) : { error: null }
  if (spendErr) {
    const insufficient = spendErr.message.includes('INSUFFICIENT_CREDITS')
    return Response.json({ error: insufficient ? `프롬코인이 부족해요 (${cost} 필요)` : '결제 실패', charge: insufficient ? '/credits' : undefined }, { status: insufficient ? 402 : 500 })
  }
  const refund = async () => cost > 0 && createAdminClient().rpc('refund_credits', { p_user_id: user.id, p_amount: cost, p_ref: ref } as never)
  if (useModal) {
    try {
      const img = String(input.input_image_url ?? '')
      const payload = mode === 'text' ? { mode: 'text', prompt } : img.startsWith('data:') ? { mode: 'image', image_b64: img.slice(img.indexOf(',') + 1) } : { mode: 'image', image_url: img }
      const r = await fetch(`${MODAL()}/submit`, { method: 'POST', headers: modalHeaders(), body: JSON.stringify(payload) })
      const j = await r.json().catch(() => ({})) as { id?: string; detail?: unknown }
      if (!r.ok || !j.id) { await refund(); return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: j.detail }, { status: 502 }) }
      const token = sign({ p: 'modal', u: user.id, rid: j.id, st: '', rs: '', ref, cost, mode, title, prompt, pbr: false, at: Date.now() })
      return Response.json({ token, cost })
    } catch (e) {
      await refund()
      return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: String((e as Error).message) }, { status: 502 })
    }
  }
  try {
    const r = await fetch(`${FAL}/${endpoint}`, { method: 'POST', headers: falHeaders(), body: JSON.stringify(input) })
    const j = await r.json().catch(() => ({})) as { request_id?: string; status_url?: string; response_url?: string; detail?: unknown }
    if (!r.ok || !j.request_id || !j.status_url || !j.response_url) { await refund(); return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: j.detail }, { status: 502 }) }
    const token = sign({ u: user.id, rid: j.request_id, st: j.status_url, rs: j.response_url, ref, cost, mode, title, prompt, pbr, at: Date.now() })
    return Response.json({ token, cost })
  } catch (e) {
    await refund()
    return Response.json({ error: '3D 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: String((e as Error).message) }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const u = new URL(req.url)
  const admin = createAdminClient()
  if (u.searchParams.get('mine')) {
    const { data } = await admin.from('media_assets').select('id,name,title,description,url,bytes,meta,created_at').eq('kind', 'model3d').eq('designer_id', user.id).order('created_at', { ascending: false }).limit(60)
    const modal = !!(MODAL() && process.env.MODAL_3D_TOKEN)
    return Response.json({ items: data ?? [], cost: await costOf(false, modal), pbr: !modal })
  }
  const t = verify(u.searchParams.get('token') ?? '')
  if (!t || t.u !== user.id) return Response.json({ error: 'bad token' }, { status: 400 })

  // 이미 등록했으면 그대로 (새로고침·중복 호출)
  const { data: done } = await admin.from('media_assets').select('id,name,title,url,bytes,meta').eq('kind', 'model3d').eq('meta->>fal_request', t.rid).maybeSingle()
  if (done) return Response.json({ status: 'done', asset: done })

  const refundOnce = async (why: string) => {
    if (t.cost > 0) {
      const { data: already } = await admin.from('credit_ledger').select('id').eq('user_id', user.id).eq('ref_id', t.ref).gt('amount', 0).limit(1)
      if (!(already ?? []).length) await admin.rpc('refund_credits', { p_user_id: user.id, p_amount: t.cost, p_ref: t.ref } as never)
    }
    return Response.json({ status: 'failed', error: why + (t.cost > 0 ? ' — 프롬코인은 돌려드렸어요' : '') })
  }
  const elapsed = Math.round((Date.now() - t.at) / 1000)
  let glbUrl: string | undefined, thumbUrl: string | undefined, fetchHeaders: Record<string, string> = {}
  if (t.p === 'modal') {
    const s = await fetch(`${MODAL()}/result/${t.rid}`, { headers: modalHeaders() }).then((r) => r.json()).catch(() => null) as { status?: string; error?: string; thumb?: boolean } | null
    if (s?.status === 'failed') return refundOnce('3D 모델을 만들지 못했어요')
    if (s?.status !== 'done') {
      if (Date.now() - t.at > 20 * 60_000) return refundOnce('3D 생성이 너무 오래 걸려 취소했어요')
      return Response.json({ status: 'running', elapsed })
    }
    glbUrl = `${MODAL()}/result/${t.rid}/glb`
    if (s.thumb) thumbUrl = `${MODAL()}/result/${t.rid}/thumb`
    fetchHeaders = { Authorization: `Bearer ${process.env.MODAL_3D_TOKEN}` }
  } else {
  const s = await fetch(t.st, { headers: falHeaders() }).then((r) => r.json()).catch(() => null) as { status?: string; queue_position?: number } | null
  const st = s?.status ?? 'UNKNOWN'
  if (st === 'IN_QUEUE' || st === 'IN_PROGRESS') return Response.json({ status: st === 'IN_QUEUE' ? 'queued' : 'running', position: s?.queue_position ?? null, elapsed })
  if (st !== 'COMPLETED') {
    if (Date.now() - t.at > 20 * 60_000) return refundOnce('3D 생성이 너무 오래 걸려 취소했어요')
    return Response.json({ status: 'running', elapsed })
  }
  const res = await fetch(t.rs, { headers: falHeaders() }).then((r) => r.json()).catch(() => null) as { model_glb?: { url?: string; file_size?: number }; thumbnail?: { url?: string }; detail?: unknown } | null
  glbUrl = res?.model_glb?.url
  thumbUrl = res?.thumbnail?.url
  if (!glbUrl) return refundOnce('3D 모델을 만들지 못했어요')
  }

  // GLB · 썸네일을 우리 스토리지로 (fal 링크는 시간이 지나면 사라진다)
  const gr = await fetch(glbUrl, { headers: fetchHeaders })
  if (!gr.ok) return Response.json({ status: 'running', note: 'download' })
  const glb = Buffer.from(await gr.arrayBuffer())
  const id = crypto.randomUUID(), path = `model3d/${id}.glb`
  const up = await admin.storage.from(BUCKET).upload(path, glb, { contentType: 'model/gltf-binary', cacheControl: '31536000', upsert: false })
  if (up.error) return Response.json({ status: 'running', note: 'saving' })   // 다음 확인 때 다시 시도
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  let thumb: string | null = null
  if (thumbUrl) {
    try {
      const tb = Buffer.from(await (await fetch(thumbUrl, { headers: fetchHeaders })).arrayBuffer())
      const tp = `model3d/${id}.png`
      if (!(await admin.storage.from(BUCKET).upload(tp, tb, { contentType: 'image/png', cacheControl: '31536000' })).error) thumb = admin.storage.from(BUCKET).getPublicUrl(tp).data.publicUrl
    } catch { /* 썸네일 없이 */ }
  }
  let name = toAssetName('m3d_' + (t.title || 'model'))
  for (let i = 0; i < 20; i++) { const { data: dup } = await admin.from('media_assets').select('id').eq('name', name).maybeSingle(); if (!dup) break; name = `${name.slice(0, 32)}_${Math.random().toString(36).slice(2, 6)}` }
  const row = {
    kind: 'model3d', name, title: t.title || '3D 모델', description: t.prompt || null, genres: [] as string[], tags: ['ai3d', t.mode], path, url, mime: 'model/gltf-binary', bytes: glb.length,
    meta: { fal_request: t.rid, source: t.mode, pbr: t.pbr, thumb, generator: t.p === 'modal' ? 'trellis' : 'hunyuan3d-v3.1-rapid' },
    auto_use: false, status: 'active', designer_id: user.id, created_by: user.id, credit_cost: 0,
  }
  const { data: ins, error } = await admin.from('media_assets').insert([row] as never).select('id,name,title,url,bytes,meta').maybeSingle()
  if (error) {
    // 동시에 두 번 들어와 이미 등록된 경우
    const { data: again } = await admin.from('media_assets').select('id,name,title,url,bytes,meta').eq('kind', 'model3d').eq('meta->>fal_request', t.rid).maybeSingle()
    if (again) { await admin.storage.from(BUCKET).remove([path]); return Response.json({ status: 'done', asset: again }) }
    return Response.json({ status: 'running', note: error.message })
  }
  return Response.json({ status: 'done', asset: ins })
}
