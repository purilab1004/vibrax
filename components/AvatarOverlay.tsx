'use client'

import { useEffect, useRef, useState } from 'react'

const AVATAR_URL = '/avatars/companion.glb'
const TTS_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY ?? ''

let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  return sharedAudioCtx
}

type Status = 'loading' | 'ready' | 'error'

export default function AvatarOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headRef = useRef<any>(null)
  const readyRef = useRef(false)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      console.log('[Avatar] Starting init...')

      // 1. Check GLB reachable
      const glbCheck = await fetch(AVATAR_URL, { method: 'HEAD' }).catch(() => null)
      console.log('[Avatar] GLB HEAD status:', glbCheck?.status ?? 'fetch failed')

      // 2. Load TalkingHead module
      console.log('[Avatar] Loading talkinghead.mjs...')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import(/* webpackIgnore: true */ '/talkinghead.mjs')
      console.log('[Avatar] Module loaded, exports:', Object.keys(mod))

      if (cancelled || !containerRef.current) return

      const { TalkingHead } = mod
      if (!TalkingHead) throw new Error('TalkingHead export not found')

      console.log('[Avatar] Creating TalkingHead instance...')
      const head = new TalkingHead(containerRef.current, {
        ttsEndpoint: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`,
        lipsyncModules: ['en'],
        cameraView: 'upper',
      })

      console.log('[Avatar] Loading avatar GLB:', AVATAR_URL)
      await head.showAvatar({
        url: AVATAR_URL,
        body: 'F',
        avatarMood: 'neutral',
        ttsLang: 'en-US',
      })

      console.log('[Avatar] Avatar ready!')
      headRef.current = head
      readyRef.current = true
      setStatus('ready')
    }

    init().catch((err) => {
      console.error('[Avatar] Init failed:', err)
      setErrorMsg(String(err))
      setStatus('error')
    })

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
              voice: { languageCode: 'en-US', name: 'en-US-Wavenet-F' },
              audioConfig: { audioEncoding: 'MP3' },
            }),
          }
        )
        const json = await res.json()
        if (!json.audioContent) { console.warn('[Avatar] TTS no audioContent:', json); return }

        const binary = atob(json.audioContent)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        const ctx = getAudioCtx()
        if (ctx.state === 'suspended') await ctx.resume()
        const audio = await ctx.decodeAudioData(bytes.buffer.slice(0))

        // English word-timing lipsync
        const words = text.split(/\s+/).filter(Boolean)
        const totalMs = audio.duration * 1000
        const perWord = totalMs / Math.max(words.length, 1)
        head.speakAudio(
          {
            audio,
            words,
            wtimes: words.map((_, i) => i * perWord),
            wdurations: words.map(() => perWord * 0.85),
          },
          { lipsyncLang: 'en' }
        )
      } catch (err) {
        console.error('[Avatar] speak error:', err)
      }
    }

    window.addEventListener('avatar:speak', handler)
    return () => window.removeEventListener('avatar:speak', handler)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050508' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-6 h-6 border-2 border-[#00ff41] border-t-transparent rounded-full animate-spin" />
          <span className="font-pixel text-[8px] text-gray-500">LOADING AJ...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 pointer-events-none">
          <span className="font-pixel text-[8px] text-red-500">AVATAR ERROR</span>
          <span className="text-[8px] text-gray-600 text-center break-all">{errorMsg.slice(0, 80)}</span>
        </div>
      )}
    </div>
  )
}
