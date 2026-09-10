// lib/tts/elevenlabs.ts — ElevenLabs TTS (서버 전용). /api/tts 와 외부 AJ API 가 공용.
export const VOICE_IDS = {
  female: 'AW5wrnG1jVizOYY7R1Oo', // Jiyoung — Warm and Clear
  male: 'sQ3a15DhENXU8pKTHlcc',   // Mr. K — Korean Creator Voice
} as const

/** 텍스트 → mp3 스트림. 미설정이면 null, 실패면 throw. */
export async function synthesizeSpeech(text: string, gender: 'male' | 'female'): Promise<Response | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return null
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[gender]}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8 } }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[tts] elevenlabs error', res.status, detail.slice(0, 300))
    throw new Error('tts failed')
  }
  return res
}
