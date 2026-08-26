'use client'
// AJ 신경망 — 입력·은닉·출력 뉴런을 네온으로 배치하고, 시냅스(가중치)를 초록(양)/빨강(음)으로 잇는다.
// 뉴런은 글로우 헤일로로 맥동하고, 발달한 신경 줄기에는 빛 입자가 흐른다. 두뇌가 유기적으로 부유·회전한다.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface Brain3D { arch: [number, number, number]; inputs: string[]; outputs: string[]; w1: number[][]; w2: number[][] }
const IN_LABEL: Record<string, string> = { ballX: '공 X', ballY: '공 Y', ballDx: '속도 X', ballDy: '속도 Y', paddleX: '패들 X', paddleW: '패들폭', score: '점수', lives: '목숨', stage: '단계', bricksLeft: '벽돌', px: '조각X', prot: '회전', ptype: '조각', level: '레벨', lines: '라인', maxH: '높이', holes: '구멍', bump: '요철', attached: '붙음' }
const OUT_LABEL: Record<string, string> = { left: '왼쪽', right: '오른쪽', up: '위', down: '아래', action: '액션', action2: '액션2' }

let _halo: THREE.Texture | null = null
function haloTex() {
  if (_halo) return _halo
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  _halo = new THREE.CanvasTexture(c); return _halo
}
function label(text: string, color: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const x = c.getContext('2d')!
  x.font = '700 30px -apple-system, system-ui, sans-serif'; x.fillStyle = color; x.textBaseline = 'middle'
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 6
  x.fillText(text, 8, 34)
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(3.4, 0.85, 1); return sp
}

export default function BrainNetwork3D({ b, height = 340 }: { b: Brain3D | null; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const demo = !b
    const arch: [number, number, number] = b?.arch ?? [5, 6, 1]
    const inputs = b?.inputs ?? ['높이', '속도', '거리', '틈 위', '틈 아래']
    const outputs = b?.outputs ?? ['날갯짓']
    const rand = () => (Math.random() * 2 - 1)
    const w1 = b?.w1 ?? Array.from({ length: arch[0] }, () => Array.from({ length: arch[1] }, rand))
    const w2 = b?.w2 ?? Array.from({ length: arch[1] }, () => Array.from({ length: arch[2] }, rand))
    const [ni, nh, no] = arch

    const W = el.clientWidth || 640
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, height)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, W / height, 0.1, 100); camera.position.set(0, 0, 15)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 30
    controls.autoRotate = true; controls.autoRotateSpeed = 1.1
    controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.9
    // 사용자가 만지면 자동회전 멈춤
    renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false })
    renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.cursor = 'grab'
    renderer.domElement.addEventListener('pointerdown', () => { renderer.domElement.style.cursor = 'grabbing' })
    window.addEventListener('pointerup', () => { renderer.domElement.style.cursor = 'grab' })
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x66ccff, 1.4, 80); pl.position.set(-6, 6, 12); scene.add(pl)
    const group = new THREE.Group(); scene.add(group)

    const colX = [-6.2, 0, 6.2]
    const spread = (i: number, n: number, span = 6.4) => n <= 1 ? 0 : (i / (n - 1) - 0.5) * span
    const zJit = () => (Math.random() - 0.5) * 1.6
    const inPos = inputs.map((_, i) => new THREE.Vector3(colX[0], spread(i, ni), zJit()))
    const hidPos = Array.from({ length: nh }, (_, i) => new THREE.Vector3(colX[1], spread(i, nh), zJit()))
    const outPos = outputs.map((_, i) => new THREE.Vector3(colX[2], spread(i, no), zJit()))

    const nodes: { mesh: THREE.Mesh; halo: THREE.Sprite; base: number; phase: number }[] = []
    const addNode = (v: THREE.Vector3, r: number, color: number, emissive: number, haloColor: number, em: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: demo ? em * 0.5 : em, roughness: 0.3, metalness: 0.1 }))
      mesh.position.copy(v); group.add(mesh)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: haloColor, transparent: true, opacity: demo ? 0.3 : 0.65, blending: THREE.AdditiveBlending, depthWrite: false }))
      halo.position.copy(v); halo.scale.setScalar(r * 6); group.add(halo)
      nodes.push({ mesh, halo, base: r, phase: Math.random() * Math.PI * 2 })
    }
    inPos.forEach(v => addNode(v, 0.34, 0x38bdf8, 0x0ea5e9, 0x38bdf8, 0.7))
    hidPos.forEach(v => addNode(v, 0.24, 0x818cf8, 0x4338ca, 0x818cf8, 0.5))
    outPos.forEach(v => addNode(v, 0.44, 0xf472b6, 0xdb2777, 0xf472b6, 0.8))

    inputs.forEach((f, i) => { const s = label(IN_LABEL[f] ?? f, '#dbeafe'); s.position.copy(inPos[i]).add(new THREE.Vector3(-2.9, 0, 0)); group.add(s) })
    outputs.forEach((a, i) => { const s = label(OUT_LABEL[a] ?? a, '#fbcfe8'); s.position.copy(outPos[i]).add(new THREE.Vector3(1.7, 0, 0)); group.add(s) })

    const maxW = Math.max(0.001, ...w1.flat().map(Math.abs), ...w2.flat().map(Math.abs))
    const flows: { a: THREE.Vector3; b: THREE.Vector3; mesh: THREE.Mesh; halo: THREE.Sprite; speed: number; t: number }[] = []
    const addEdges = (from: THREE.Vector3[], to: THREE.Vector3[], w: number[][]) => {
      for (let i = 0; i < from.length; i++) for (let j = 0; j < to.length; j++) {
        const val = w[i]?.[j] ?? 0; const a = Math.abs(val) / maxW
        const col = new THREE.Color(val >= 0 ? 0x34d399 : 0xfb7185)
        const geo = new THREE.BufferGeometry().setFromPoints([from[i], to[j]])
        group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: (demo ? 0.1 : 0.08) + a * (demo ? 0.28 : 0.7) })))
        if (a > 0.5 && !demo) {
          const c = val >= 0 ? 0x6ee7b7 : 0xfda4af
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: c }))
          const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(0.9)
          group.add(dot); group.add(halo)
          flows.push({ a: from[i], b: to[j], mesh: dot, halo, speed: 0.35 + a * 0.9, t: Math.random() })
        }
      }
    }
    addEdges(inPos, hidPos, w1); addEdges(hidPos, outPos, w2)

    let raf = 0; const clock = new THREE.Clock()
    const loop = () => {
      const dt = clock.getDelta(), et = clock.elapsedTime
      controls.update()
      for (const n of nodes) { const s = 1 + Math.sin(et * 1.6 + n.phase) * 0.12; n.mesh.scale.setScalar(s); n.halo.scale.setScalar(n.base * 6 * (0.9 + Math.sin(et * 1.6 + n.phase) * 0.18)) }
      for (const f of flows) { f.t = (f.t + dt * f.speed) % 1; f.mesh.position.lerpVectors(f.a, f.b, f.t); f.halo.position.copy(f.mesh.position) }
      renderer.render(scene, camera); raf = requestAnimationFrame(loop)
    }
    loop()
    const onResize = () => { const w = el.clientWidth || 640; renderer.setSize(w, height); camera.aspect = w / height; camera.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)
    // 리셋 버튼
    const resetHandler = () => { controls.reset(); controls.autoRotate = true }
    el.addEventListener('vbx-brain-reset', resetHandler)
    controls.saveState()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); el.removeEventListener('vbx-brain-reset', resetHandler); controls.dispose(); renderer.dispose(); if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement) }
  }, [b, height])
  return (
    <div className="relative">
      <div ref={ref} className="w-full" style={{ height }} />
      <div className="absolute top-2 right-3 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] text-white/40">드래그 회전 · 스크롤 확대</span>
        <button onClick={() => ref.current?.dispatchEvent(new CustomEvent('vbx-brain-reset'))} className="pointer-events-auto text-[10.5px] font-semibold text-white/70 bg-white/10 border border-white/15 rounded-full px-2.5 py-1 hover:bg-white/20">리셋</button>
      </div>
      {!b && (
        <div className="absolute top-2 left-3 flex items-center gap-1.5 pointer-events-none">
          <span className="text-[10px] font-extrabold tracking-wide text-amber-300 bg-amber-400/15 border border-amber-300/30 rounded-full px-2 py-0.5">예시 (실제 아님)</span>
        </div>
      )}
    </div>
  )
}
