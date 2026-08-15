// lib/jeumto/tts.ts — /api/tts(ElevenLabs 프록시)로 음성을 받아 재생. 재생 길이(ms)를 돌려준다.
import type { Gender } from './config'

let ctx: AudioContext | null = null
function audioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext()
  return ctx
}

export async function speakText(text: string, gender: Gender): Promise<{ durationMs: number }> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, gender }),
  })
  if (!res.ok) throw new Error(`TTS error: ${res.status}`)
  const bytes = await res.arrayBuffer()
  const ac = audioContext()
  const buffer = await ac.decodeAudioData(bytes.slice(0))
  if (ac.state === 'suspended') await ac.resume().catch(() => {})
  const src = ac.createBufferSource()
  src.buffer = buffer
  src.connect(ac.destination)
  src.start()
  return { durationMs: buffer.duration * 1000 }
}
