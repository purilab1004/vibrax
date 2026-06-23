// components/avatar/AvatarStage.tsx
'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { AvatarEngine } from '@/lib/avatar/engine'
import type { Selection } from '@/lib/avatar/catalog'

export interface AvatarStageHandle {
  snapshot: () => Promise<Blob | null>
  setExpression: (name: string) => void
}
interface Props { selection: Selection; eyeColor: string | null; view?: 'upper' | 'full' }

export default forwardRef<AvatarStageHandle, Props>(function AvatarStage({ selection, eyeColor, view = 'full' }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<AvatarEngine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new AvatarEngine(containerRef.current, { view })
    engineRef.current = engine
    engine.init().catch((e) => console.error('[AvatarStage] init failed', e))
    return () => { engine.dispose(); engineRef.current = null }
  }, [view])

  useEffect(() => { engineRef.current?.applySelection(selection) }, [selection])
  useEffect(() => { engineRef.current?.setEyeColor(eyeColor) }, [eyeColor])

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return null
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
    },
    setExpression: (name: string) => engineRef.current?.setExpression(name, name === 'neutral' ? 0 : 1),
  }), [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})
