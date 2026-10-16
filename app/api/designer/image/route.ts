// /api/designer/image — 디자인 AI 이미지 생성 (Modal Qwen-Image · Apache 2.0)
// POST { prompt, preset, style, ratio, transparent } → 프롬코인 차감 → 한국어 프롬프트를 영어로 다듬어 Modal 에 제출 → { token }
// GET ?token=          → { status:'running' } | { status:'done', images:[url…] } | { status:'failed' }(환불)
// GET ?token=&i=0..3   → 생성된 이미지(webp) — 저장 전 미리보기용 (드라이브 저장은 /api/designer/drive save_image)
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDesigner } from '@/lib/designer/drive'
import { toEnglish } from '@/lib/designer/translate'
import { modalReady as modalUp, modalSubmit, modalStatus, modalFile, signToken, verifyToken, type ImageTok } from '@/lib/modal/client'

export const runtime = 'nodejs'
export const maxDuration = 60
const SALT = 'vibrex-image'
const modalReady = modalUp
const DEFAULT_COST = 4   // 4장 한 번에 (Modal H100 약 1~2분 ≈ $0.1)

const PRESETS: Record<string, string> = {
  free: '',
  character: 'single game character, full body, centered, front-facing three-quarter view, clean silhouette, plain white background, game asset',
  item: 'single game item icon, centered, isolated object, plain white background, game asset, clean edges',
  background: 'game background scenery, wide environment, no characters, no text, rich depth',
  tile: 'seamless tileable game texture, top-down, evenly lit',
  ui: 'game UI element, clean flat design, centered, plain background',
  effect: 'game visual effect, glowing magic particles, centered, plain black background',
}
const STYLES: Record<string, string> = {
  auto: '', pixel: 'pixel art, 32-bit, crisp pixels, limited palette', cartoon: 'cute cartoon style, bold outlines, vibrant flat colors',
  anime: 'anime style, cel shading', realistic: 'photorealistic, detailed textures, cinematic lighting', '3d': '3D render, soft studio lighting, stylized clay-like', watercolor: 'watercolor illustration, soft paper texture',
}
const RATIOS: Record<string, [number, number]> = { '1:1': [1024, 1024], '9:16': [768, 1360], '16:9': [1360, 768], '3:4': [896, 1184], '4:3': [1184, 896] }

async function costOf() {
  const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'image_gen_cost').maybeSingle()
  const c = Number((data as { value?: unknown } | null)?.value)
  return Number.isFinite(c) && c >= 0 ? c : DEFAULT_COST
}

export async function POST(req: Request) {
  const g = await requireDesigner(); if ('error' in g) return g.error
  if (!modalReady()) return Response.json({ error: '이미지 생성 서버가 아직 준비되지 않았어요' }, { status: 503 })
  const body = await req.json().catch(() => null) as { prompt?: string; preset?: string; style?: string; ratio?: string; transparent?: boolean } | null
  const prompt = (body?.prompt ?? '').trim().slice(0, 500)
  if (prompt.length < 2) return Response.json({ error: '만들 이미지를 설명해 주세요' }, { status: 400 })
  const preset = PRESETS[body?.preset ?? ''] ?? '', style = STYLES[body?.style ?? ''] ?? ''
  const [width, height] = RATIOS[body?.ratio ?? ''] ?? RATIOS['1:1']
  const transparent = body?.transparent === true

  const cost = await costOf()
  const ref = `img:${crypto.randomUUID()}`
  if (cost > 0) {
    const { error } = await g.supabase.rpc('spend_credits', { p_amount: cost, p_ref: ref } as never)
    if (error) {
      const insufficient = error.message.includes('INSUFFICIENT_CREDITS')
      return Response.json({ error: insufficient ? `프롬코인이 부족해요 (${cost} 필요)` : '결제 실패' }, { status: insufficient ? 402 : 500 })
    }
  }
  const refund = async () => { if (cost > 0) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: cost, p_ref: ref } as never) }
  try {
    const en = await toEnglish(prompt)
    const full = [en, preset, style].filter(Boolean).join(', ')
    const r = await modalSubmit({ mode: 'img', prompt: full, n: 4, width, height, transparent })
    if (!r.ok || !r.id) { await refund(); return Response.json({ error: '이미지 생성 요청 실패 — 프롬코인은 돌려드렸어요' }, { status: 502 }) }
    const tok: ImageTok = { u: g.user.id, rid: r.id, ref, cost, prompt, at: Date.now() }
    return Response.json({ token: signToken(SALT, tok), cost, prompt_en: full })
  } catch (e) {
    await refund()
    return Response.json({ error: '이미지 생성 요청 실패 — 프롬코인은 돌려드렸어요', detail: String((e as Error).message) }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get('info')) { return Response.json({ cost: await costOf(), ready: modalReady(), presets: Object.keys(PRESETS), styles: Object.keys(STYLES), ratios: Object.keys(RATIOS) }) }
  const g = await requireDesigner(); if ('error' in g) return g.error
  const t = verifyToken<ImageTok>(SALT, u.searchParams.get('token') ?? '')
  if (!t || t.u !== g.user.id) return Response.json({ error: 'bad token' }, { status: 400 })
  const i = u.searchParams.get('i')
  if (i !== null) {
    const buf = await modalFile(t.rid, `img${Number(i) | 0}`)
    if (!buf) return new Response('not found', { status: 404 })
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=3600' } })
  }
  const s = await modalStatus(t.rid)
  const elapsed = Math.round((Date.now() - t.at) / 1000)
  if (s?.status === 'done') {
    const tk = encodeURIComponent(u.searchParams.get('token')!)
    return Response.json({ status: 'done', images: Array.from({ length: s.images ?? 0 }, (_, k) => `/api/designer/image?token=${tk}&i=${k}`) })
  }
  if (s?.status === 'failed' || Date.now() - t.at > 15 * 60_000) {
    if (t.cost > 0) {
      const { data: already } = await g.admin.from('credit_ledger').select('id').eq('user_id', g.user.id).eq('ref_id', t.ref).gt('amount', 0).limit(1)
      if (!(already ?? []).length) await g.admin.rpc('refund_credits', { p_user_id: g.user.id, p_amount: t.cost, p_ref: t.ref } as never)
    }
    return Response.json({ status: 'failed', error: '이미지를 만들지 못했어요' + (t.cost > 0 ? ' — 프롬코인은 돌려드렸어요' : '') })
  }
  return Response.json({ status: 'running', elapsed })
}
