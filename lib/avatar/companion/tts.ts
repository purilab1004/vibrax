// TTS 호출 + word timing 계산 — ElevenLabs(/api/tts 프록시) 기반

import { type Lang, type Gender, type Reaction, TTS_CONFIG } from './locales'

export interface SpeakPayload {
  audio: AudioBuffer
  words: string[]
  wtimes: number[]   // ms
  wdurations: number[] // ms
}

let sharedAudioCtx: AudioContext | null = null
function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  return sharedAudioCtx
}

export async function elevenTTS(
  reaction: Reaction,
  lang: Lang,
  gender: Gender,
): Promise<SpeakPayload> {
  void TTS_CONFIG // Google 보이스 설정은 미사용 — 보이스는 서버(/api/tts)의 ElevenLabs voice id로 결정
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: reaction.text, gender }),
  })
  if (!res.ok) throw new Error(`TTS error: ${res.status}`)
  const bytes = await res.arrayBuffer()

  const audioCtx = getAudioContext()
  const audio = await audioCtx.decodeAudioData(bytes.slice(0))

  // ko는 roman 발음, en은 text로 word timing 계산
  const wordSource = reaction.roman ?? reaction.text
  const words = wordSource.split(/\s+/).filter(Boolean)
  const totalMs = audio.duration * 1000
  const perWord = totalMs / Math.max(words.length, 1)

  return {
    audio,
    words,
    wtimes: words.map((_, i) => i * perWord),
    wdurations: words.map(() => perWord * 0.85),
  }
}

export function playAudio(payload: SpeakPayload): void {
  const audioCtx = getAudioContext()
  // context가 suspended면 resume 시도 (유저 제스처 없이 재생 시 브라우저 정책상 무시될 수 있음)
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  const source = audioCtx.createBufferSource()
  source.buffer = payload.audio
  source.connect(audioCtx.destination)
  source.start()
}
