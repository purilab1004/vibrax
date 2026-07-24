// lib/avatar/companion/CustomBjOverlay.tsx
'use client'
// In-game BJ rendered from the game creator's saved avatar config.
// Drives the drei companion (assembled VRM + lipsync/anim/lookAt) from the
// existing `avatar:speak` { text } event that AiBjPanel dispatches with the
// LLM commentary. Fills its container (mounted inside AiBjPanel's avatar box).
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CompanionAvatar, type CameraSettings } from './CompanionAvatar'
import { elevenTTS, type SpeakPayload } from './tts'
import type { Gender } from './locales'
import { SceneLights } from '../components/SceneLights'
import { GradingEffects } from '../components/GradingEffects'
import { applyConfig } from '../storage'
import type { AvatarConfig } from '../config'

function CameraRig({ settings }: { settings: CameraSettings }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(...settings.position)
    camera.lookAt(...settings.target)
  }, [settings, camera])
  return null
}

function genderFor(config: AvatarConfig): Gender {
  if (config.gender) return config.gender
  return config.characterId === 'female1' ? 'female' : 'male'
}

export default function CustomBjOverlay({ config }: { config: AvatarConfig }) {
  // Push the creator's config into the shared store once, before children mount,
  // so CompanionAvatar assembles the right base + parts on first load (lazy
  // initializer runs during the first render, ahead of the child avatar).
  useState(() => { applyConfig(config); return null })

  const gender = genderFor(config)
  const speakRef = useRef<((payload: SpeakPayload) => void) | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [assembled, setAssembled] = useState(false)
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null)

  const handleReady = useCallback((speak: (payload: SpeakPayload) => void) => {
    speakRef.current = speak
  }, [])

  useEffect(() => {
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const handler = async (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim()
      if (!text) return
      setBubble(text)
      setSpeaking(true)
      const end = () => { setBubble(null); setSpeaking(false) }
      if (speakRef.current) {
        try {
          const payload = await elevenTTS({ text }, 'ko', gender)
          speakRef.current(payload)
          endTimer = setTimeout(end, payload.audio.duration * 1000 + 500)
        } catch (err) {
          console.error('[CustomBj] TTS failed:', err)
          endTimer = setTimeout(end, 3000)
        }
      } else {
        endTimer = setTimeout(end, 5000)
      }
    }
    window.addEventListener('avatar:speak', handler)
    return () => { window.removeEventListener('avatar:speak', handler); if (endTimer) clearTimeout(endTimer) }
  }, [gender])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050508' }}>
      <Canvas camera={{ position: [0, 1.4, 2.5], fov: 28 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <SceneLights />
        <Suspense fallback={null}>
          <CompanionAvatar speaking={speaking} mood="neutral" onReady={handleReady} onCameraReady={setCameraSettings} onAssembledChange={setAssembled} />
        </Suspense>
        {cameraSettings && <CameraRig settings={cameraSettings} />}
        <GradingEffects />
      </Canvas>
      {!assembled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-6 h-6 border-2 border-[#00ff41] border-t-transparent rounded-full animate-spin" />
          <span className="font-pixel text-[8px] text-gray-500 tracking-widest">BJ 로딩 중…</span>
        </div>
      )}
      {bubble && (
        <div className="absolute left-1.5 right-1.5 top-1.5 pointer-events-none">
          <div className="bg-black/75 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-100 leading-snug line-clamp-3">
            💬 {bubble}
          </div>
        </div>
      )}
    </div>
  )
}
