'use client'

import { useEffect, useRef, useState } from 'react'

// 보유 아바타 — 게임 시작 시(컴포넌트 마운트) 랜덤 배정
const AVATARS = [
  '/avatars/companion.glb',     // AJ (기존)
  '/avatars/sample-b.glb',      // Sample B
  '/avatars/vroid-custom.glb',  // My VRoid
] as const

function pickRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]
}

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
  // 마운트 시 한 번만 랜덤 배정 — 세션 동안 고정
  const [avatarUrl] = useState(pickRandomAvatar)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      console.log('[Avatar] Starting init... avatar:', avatarUrl)

      // 1. Check GLB reachable
      const glbCheck = await fetch(avatarUrl, { method: 'HEAD' }).catch(() => null)
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
        lightAmbientColor: 0xffffff,
        lightAmbientIntensity: 3,
        lightDirectColor: 0xfff5e0,  // 따뜻한 흰색 (기본 파란빛 회색 0x8888aa 대비)
        lightDirectIntensity: 25,
        lightSpotColor: 0xffffff,
        lightSpotIntensity: 15,      // Head 본 타겟 스팟 활성화
        lightSpotPhi: 0.5,           // 정면 위쪽에서 비춤
        lightSpotTheta: 3.14,        // 카메라 방향 (정면)
        lightSpotDispersion: 0.8,
      })

      console.log('[Avatar] Loading avatar GLB:', avatarUrl)
      await head.showAvatar({
        url: avatarUrl,
        body: 'F',
        avatarMood: 'neutral',
        ttsLang: 'en-US',
      })

      // 로컬 /avatars/ GLB는 toon 셰이딩 + 부드러운 조명으로 보정
      if (avatarUrl.startsWith('/avatars/')) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — esm.sh CDN, talkinghead.mjs와 동일 three 인스턴스 공유
        const THREE = await import(/* webpackIgnore: true */ 'https://esm.sh/three@0.180.0')

        // 2단계 그라디언트: shadow를 밝게 유지 → 인위적 명암 경계 최소화
        const gradData = new Uint8Array([160, 255])
        const gradientMap = new THREE.DataTexture(gradData, 2, 1, THREE.RedFormat)
        gradientMap.minFilter = THREE.NearestFilter
        gradientMap.magFilter = THREE.NearestFilter
        gradientMap.needsUpdate = true

        /* eslint-disable @typescript-eslint/no-explicit-any */
        ;(head as any).renderer.toneMappingExposure = 0.65
        ;(head as any).scene.environmentIntensity = 0.0
        ;(head as any).setLighting({
          lightAmbientIntensity: 2.5,
          lightDirectColor: 0xffffff,
          lightDirectIntensity: 3,
          lightDirectPhi: 0.3,
          lightDirectTheta: 3.14,
          lightSpotIntensity: 0,
        })

        const replaceMat = (mat: any): any => {
          if (!mat?.isMeshStandardMaterial) return mat
          const toon = new THREE.MeshToonMaterial({
            map:         mat.map,
            color:       mat.color.clone(),
            gradientMap,
            alphaMap:    mat.alphaMap,
            transparent: mat.transparent,
            opacity:     mat.opacity,
            alphaTest:   mat.alphaTest,
            side:        mat.side,
            depthWrite:  mat.depthWrite,
          })
          mat.dispose()
          return toon
        }

        ;(head as any).scene.traverse((obj: any) => {
          if (!obj.isMesh) return
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(replaceMat)
          } else {
            obj.material = replaceMat(obj.material)
          }
        })
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }

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
  }, [avatarUrl])

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
          <span className="font-pixel text-[10px] text-gray-500">LOADING AJ...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 pointer-events-none">
          <span className="font-pixel text-[10px] text-red-500">AVATAR ERROR</span>
          <span className="text-[10px] text-gray-600 text-center break-all">{errorMsg.slice(0, 80)}</span>
        </div>
      )}
    </div>
  )
}
