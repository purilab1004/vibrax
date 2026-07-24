// ElevenLabs TTS 프록시 — API 키를 서버에만 두고 브라우저에는 오디오만 내려준다.
export const maxDuration = 30

const VOICE_IDS = {
  female: 'AW5wrnG1jVizOYY7R1Oo', // Jiyoung — Warm and Clear
  male: 'sQ3a15DhENXU8pKTHlcc',   // Mr. K — Korean Creator Voice
} as const

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('tts not configured', { status: 503 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const { text, gender } = (body ?? {}) as { text?: unknown; gender?: unknown }
  if (typeof text !== 'string' || !text.trim() || text.length > 600) {
    return new Response('bad request', { status: 400 })
  }
  const voiceId = VOICE_IDS[gender === 'male' ? 'male' : 'female']

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2', // 한국어 지원 모델
        voice_settings: { stability: 0.45, similarity_boost: 0.8 },
      }),
    },
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[tts] elevenlabs error', res.status, detail.slice(0, 300))
    return new Response('tts failed', { status: 502 })
  }
  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  })
}
