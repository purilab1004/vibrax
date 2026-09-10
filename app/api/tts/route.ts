// ElevenLabs TTS 프록시 — API 키를 서버에만 두고 브라우저에는 오디오만 내려준다. (합성 로직: lib/tts/elevenlabs.ts)
import { synthesizeSpeech } from '@/lib/tts/elevenlabs'
export const maxDuration = 30

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) return new Response('tts not configured', { status: 503 })
  let body: unknown
  try { body = await req.json() } catch { return new Response('bad request', { status: 400 }) }
  const { text, gender } = (body ?? {}) as { text?: unknown; gender?: unknown }
  if (typeof text !== 'string' || !text.trim() || text.length > 600) return new Response('bad request', { status: 400 })
  try {
    const res = await synthesizeSpeech(text, gender === 'male' ? 'male' : 'female')
    if (!res) return new Response('tts not configured', { status: 503 })
    return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
  } catch { return new Response('tts failed', { status: 502 }) }
}
