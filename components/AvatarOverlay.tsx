'use client'

import { useEffect, useRef } from 'react'

const AVATAR_URL = '/avatars/companion.glb'
const TTS_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY ?? ''

let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  return sharedAudioCtx
}

export default function AvatarOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headRef = useRef<any>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const { TalkingHead } = await import(
        // @ts-expect-error CDN ESM — no type declarations
        'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.3/modules/talkinghead.mjs'
      )
      if (cancelled || !containerRef.current) return

      const head = new TalkingHead(containerRef.current, {
        ttsEndpoint: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`,
        cameraView: 'upper',
      })

      await head.showAvatar({
        url: AVATAR_URL,
        body: 'F',
        avatarMood: 'neutral',
        ttsLang: 'ko-KR',
      })

      headRef.current = head
      readyRef.current = true
    }

    init().catch(console.error)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handler = async (e: Event) => {
      const head = headRef.current
      if (!head || !readyRef.current || !TTS_KEY) return
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text) return

      try {
        const res = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: { text },
              voice: { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-A' },
              audioConfig: { audioEncoding: 'MP3' },
            }),
          }
        )
        const json = await res.json()
        if (!json.audioContent) return

        const binary = atob(json.audioContent)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        const ctx = getAudioCtx()
        if (ctx.state === 'suspended') await ctx.resume()
        const audio = await ctx.decodeAudioData(bytes.buffer.slice(0))

        head.speakAudio({ audio })
      } catch (err) {
        console.error('[AvatarOverlay] speak error:', err)
      }
    }

    window.addEventListener('avatar:speak', handler)
    return () => window.removeEventListener('avatar:speak', handler)
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
