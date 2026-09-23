// POST /api/v1/aj/tts — 내 AJ 목소리로 읽기 (mp3). scope: tts (개발자 API 키만 — 프롬코인 과금)
import { authenticateApi, apiError, preflight, CORS, refundApiCharge } from '@/lib/aj/api-auth'
import { synthesizeSpeech } from '@/lib/tts/elevenlabs'

export const runtime = 'nodejs'
export const maxDuration = 30
export const OPTIONS = () => preflight()

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 600) return apiError(400, 'text required (≤600 chars)')
  const id = await authenticateApi(req, 'tts')
  if (id instanceof Response) return id
  try {
    const res = await synthesizeSpeech(text, id.avatar?.voice === 'male' ? 'male' : 'female')
    if (!res) { await refundApiCharge(id); return apiError(503, 'tts not configured') }
    return new Response(res.body, { headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-AJ-Charged': String(id.charged) } })
  } catch { await refundApiCharge(id); return apiError(502, 'tts failed', { refunded: id.charged }) }
}
