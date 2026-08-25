'use client'
// 아바타 두뇌 3D — 입력·은닉·출력 층의 뉴런을 3D 로 배치하고, 시냅스(가중치)를 초록(양)/빨강(음)으로 그린다.
// 발달한(강한) 신경 줄기에는 빛 입자가 흐르고, 두뇌 전체가 천천히 회전한다. 학습 전이면 흐릿한 데모 망을 보여준다.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface Brain3D { arch: [number, number, number]; inputs: string[]; outputs: string[]; w1: number[][]; w2: number[][] }
const IN_LABEL: Record<string, string> = { ballX: '공 X', ballY: '공 Y', ballDx: '속도 X', ballDy: '속도 Y', paddleX: '패들 X', paddleW: '패들폭', score: '점수', lives: '목숨', stage: '단계', bricksLeft: '벽돌', px: '조각X', prot: '회전', ptype: '조각', level: '레벨', lines: '라인', maxH: '높이', holes: '구멍', bump: '요철', attached: '붙음' }
const OUT_LABEL: Record<string, string> = { left: '왼쪽', right: '오른쪽', up: '위', down: '아래', action: '액션', action2: '액션2' }

function textSprite(text: string, color: string) {
  const c = document.createElement('canvas'); const s = 4
  c.width = 256; c.height = 64
  const x = c.getContext('2d')!
  x.font = `700 ${28 * 1}px -apple-system, system-ui, sans-serif`
  x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'left'
  x.fillText(text, 6, 34)
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(1.6 * s / 2, 0.4 * s / 2, 1)
  return sp
}

export default function BrainNetwork3D({ b }: { b: Brain3D | null }) {
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

    const W = el.clientWidth || 600, H = 300
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    camera.position.set(0, 0, 14)
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const p1 = new THREE.PointLight(0x66ccff, 1.2, 60); p1.position.set(-6, 6, 10); scene.add(p1)
    const group = new THREE.Group(); scene.add(group)

    const colX = [-6, 0, 6]
    const spread = (i: number, n: number, span = 6) => n <= 1 ? 0 : (i / (n - 1) - 0.5) * span
    const pos = (layer: number, i: number, n: number) => new THREE.Vector3(colX[layer], spread(i, n), (Math.random() - 0.5) * 1.2)
    const inPos = inputs.map((_, i) => pos(0, i, ni))
    const hidPos = Array.from({ length: nh }, (_, i) => pos(1, i, nh))
    const outPos = outputs.map((_, i) => pos(2, i, no))

    // 뉴런
    const sphere = (v: THREE.Vector3, r: number, color: number, emissive: number, em = 0.6) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: demo ? em * 0.5 : em, roughness: 0.35 }))
      m.position.copy(v); group.add(m); return m
    }
    inPos.forEach(v => sphere(v, 0.34, 0x38bdf8, 0x0ea5e9))
    hidPos.forEach(v => sphere(v, 0.26, 0x64748b, 0x334155, 0.3))
    outPos.forEach(v => sphere(v, 0.42, 0xf472b6, 0xdb2777))

    // 라벨
    inputs.forEach((f, i) => { const sp = textSprite(IN_LABEL[f] ?? f, '#cbd5e1'); sp.position.copy(inPos[i]).add(new THREE.Vector3(-2.6, 0, 0)); group.add(sp) })
    outputs.forEach((a, i) => { const sp = textSprite(OUT_LABEL[a] ?? a, '#f9a8d4'); sp.position.copy(outPos[i]).add(new THREE.Vector3(1.4, 0, 0)); group.add(sp) })

    // 시냅스(가중치) + 발달한 줄기의 흐름 입자
    const maxW = Math.max(0.001, ...w1.flat().map(Math.abs), ...w2.flat().map(Math.abs))
    const flows: { a: THREE.Vector3; b: THREE.Vector3; mesh: THREE.Mesh; speed: number; t: number }[] = []
    const addEdges = (from: THREE.Vector3[], to: THREE.Vector3[], w: number[][]) => {
      for (let i = 0; i < from.length; i++) for (let j = 0; j < to.length; j++) {
        const val = w[i]?.[j] ?? 0; const a = Math.abs(val) / maxW
        const col = new THREE.Color(val >= 0 ? 0x22c55e : 0xf43f5e)
        const geo = new THREE.BufferGeometry().setFromPoints([from[i], to[j]])
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: (demo ? 0.12 : 0.1) + a * (demo ? 0.25 : 0.6) }))
        group.add(line)
        if (a > 0.55 && !demo) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: val >= 0 ? 0x86efac : 0xfda4af }))
          group.add(dot); flows.push({ a: from[i], b: to[j], mesh: dot, speed: 0.4 + a * 0.8, t: Math.random() })
        }
      }
    }
    addEdges(inPos, hidPos, w1)
    addEdges(hidPos, outPos, w2)

    let raf = 0; const clock = new THREE.Clock()
    const loop = () => {
      const dt = clock.getDelta()
      group.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.5
      group.rotation.x = Math.sin(clock.elapsedTime * 0.11) * 0.12
      for (const f of flows) { f.t = (f.t + dt * f.speed) % 1; f.mesh.position.lerpVectors(f.a, f.b, f.t) }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    const onResize = () => { const w = el.clientWidth || 600; renderer.setSize(w, H); camera.aspect = w / H; camera.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); renderer.dispose(); el.removeChild(renderer.domElement) }
  }, [b])
  return <div ref={ref} className="w-full" style={{ height: 300 }} />
}
