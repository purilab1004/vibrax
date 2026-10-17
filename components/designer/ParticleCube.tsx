'use client'
// 만드는 중 표시 — 무대 구석의 작은 Vibrex 빛 알갱이 V (심장처럼 두 번씩 뛴다)
import CubeLoader from './CubeLoader'

export default function ParticleCube({ size = 56 }: { size?: number }) {
  return <CubeLoader size={size} beat />
}
