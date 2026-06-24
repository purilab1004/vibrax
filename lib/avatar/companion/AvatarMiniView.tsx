// lib/avatar/companion/AvatarMiniView.tsx
'use client'
// Display-only 3D view of a saved avatar config (idle, no lipsync/speak).
// Used on the profile page to show "my character" (the in-game BJ).
import { Suspense, useCallback, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CompanionAvatar, type CameraSettings } from './CompanionAvatar'
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

export default function AvatarMiniView({ config }: { config: AvatarConfig }) {
  // Apply config to the shared store once, before the avatar child mounts.
  useState(() => { applyConfig(config); return null })
  const [cam, setCam] = useState<CameraSettings | null>(null)
  const noop = useCallback(() => {}, [])

  return (
    <Canvas camera={{ position: [0, 1.4, 2.5], fov: 28 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
      <SceneLights />
      <Suspense fallback={null}>
        <CompanionAvatar speaking={false} mood="neutral" onReady={noop} onCameraReady={setCam} />
      </Suspense>
      {cam && <CameraRig settings={cam} />}
      <GradingEffects />
    </Canvas>
  )
}
