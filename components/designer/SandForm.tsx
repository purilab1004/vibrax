'use client'
// 3D 생성 대기 화면 — 모래알 수천 개가 소용돌이치다 하나씩 모여 형태를 이루는 효과.
// 원본 이미지가 있으면 그 실루엣·색으로, 없으면(글 3D) 기본 피규어 모양으로 모인다. 시간이 갈수록 더 많이 모여 진행 표시가 된다.
import { useEffect, useRef } from 'react'
import { loadThree } from './GlbViewer'

const N = 6000
const GRID = 96
const SAND: [number, number, number] = [0.91, 0.76, 0.48]

interface Target { pos: Float32Array; col: Float32Array }

// 이미지 실루엣 위의 점들(가장자리에서 멀수록 두껍게 = 입체감) + 그 자리 색
async function fromImage(src: string): Promise<Target | null> {
  const img = await new Promise<HTMLImageElement | null>((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src })
  if (!img) return null
  const c = document.createElement('canvas'); c.width = c.height = GRID
  const g = c.getContext('2d', { willReadFrequently: true })!
  const k = Math.min(GRID / img.width, GRID / img.height), w = img.width * k, h = img.height * k
  g.drawImage(img, (GRID - w) / 2, (GRID - h) / 2, w, h)
  let px: Uint8ClampedArray
  try { px = g.getImageData(0, 0, GRID, GRID).data } catch { return null }
  const transparent = (() => { for (let i = 3; i < px.length; i += 4) if (px[i] < 200) return true; return false })()
  // 배경: 투명하면 알파, 아니면 네 귀퉁이 색과 비슷한 픽셀
  const corner = [0, GRID - 1, GRID * (GRID - 1), GRID * GRID - 1].map((p) => [px[p * 4], px[p * 4 + 1], px[p * 4 + 2]])
  const bgc = corner.reduce((a, b) => [a[0] + b[0] / 4, a[1] + b[1] / 4, a[2] + b[2] / 4], [0, 0, 0])
  const inside = new Uint8Array(GRID * GRID)
  for (let p = 0; p < GRID * GRID; p++) {
    const r = px[p * 4], gg = px[p * 4 + 1], b = px[p * 4 + 2], a = px[p * 4 + 3]
    inside[p] = transparent ? (a > 60 ? 1 : 0) : (Math.abs(r - bgc[0]) + Math.abs(gg - bgc[1]) + Math.abs(b - bgc[2]) > 60 ? 1 : 0)
  }
  // 가장자리까지 거리(두 번 훑는 근사) 두께
  const d = new Float32Array(GRID * GRID).fill(0)
  for (let p = 0; p < GRID * GRID; p++) d[p] = inside[p] ? 1e9 : 0
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) { const p = y * GRID + x; if (!inside[p]) continue; d[p] = Math.min(d[p], (x ? d[p - 1] : 0) + 1, (y ? d[p - GRID] : 0) + 1) }
  for (let y = GRID - 1; y >= 0; y--) for (let x = GRID - 1; x >= 0; x--) { const p = y * GRID + x; if (!inside[p]) continue; d[p] = Math.min(d[p], (x < GRID - 1 ? d[p + 1] : 0) + 1, (y < GRID - 1 ? d[p + GRID] : 0) + 1) }
  const cells: number[] = []; let dmax = 1
  for (let p = 0; p < GRID * GRID; p++) if (inside[p]) { cells.push(p); dmax = Math.max(dmax, d[p]) }
  if (cells.length < 40) return null
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const p = cells[(Math.random() * cells.length) | 0], x = p % GRID, y = (p / GRID) | 0
    const th = Math.sqrt(d[p] / dmax) * 0.42
    pos[i * 3] = ((x + Math.random()) / GRID - 0.5) * 2
    pos[i * 3 + 1] = -((y + Math.random()) / GRID - 0.5) * 2
    pos[i * 3 + 2] = (Math.random() < 0.5 ? -1 : 1) * th * (0.6 + Math.random() * 0.4)
    col[i * 3] = px[p * 4] / 255; col[i * 3 + 1] = px[p * 4 + 1] / 255; col[i * 3 + 2] = px[p * 4 + 2] / 255
  }
  return { pos, col }
}

// 글 3D: 둥근 머리 + 몸통 피규어 모양
function figure(): Target {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const head = Math.random() < 0.45
    const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1)
    const [rx, ry, rz, cy] = head ? [0.42, 0.4, 0.4, 0.42] : [0.34, 0.5, 0.28, -0.45]
    pos[i * 3] = rx * Math.sin(v) * Math.cos(u); pos[i * 3 + 1] = cy + ry * Math.cos(v); pos[i * 3 + 2] = rz * Math.sin(v) * Math.sin(u)
    const t = 0.75 + Math.random() * 0.25
    col[i * 3] = 0.55 * t; col[i * 3 + 1] = 0.62 * t; col[i * 3 + 2] = 0.98 * t
  }
  return { pos, col }
}

export default function SandForm({ image, expected = 90, done = false }: { image?: string | null; expected?: number; done?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const doneRef = useRef(done)
  useEffect(() => { doneRef.current = done }, [done])

  useEffect(() => {
    let stop = false, raf = 0, cleanup = () => {}
    Promise.all([loadThree(), image ? fromImage(image) : Promise.resolve(null)]).then(([, t]) => {
      if (stop || !box.current) return
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const T: any = window.THREE, el = box.current
      const target = t ?? figure()
      const W = el.clientWidth, H = el.clientHeight
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H)
      el.appendChild(renderer.domElement)
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(38, W / H, 0.01, 50)
      cam.position.set(0, 0.02, 4.1)
      // 둥근 모래알
      const dot = document.createElement('canvas'); dot.width = dot.height = 32
      const dg = dot.getContext('2d')!, grd = dg.createRadialGradient(16, 16, 0, 16, 16, 16)
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
      dg.fillStyle = grd; dg.fillRect(0, 0, 32, 32)
      const geo = new T.BufferGeometry()
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
      const seed = new Float32Array(N * 4)   // 반지름·각도·높이·모이는 순서
      for (let i = 0; i < N; i++) {
        seed[i * 4] = 1.4 + Math.random() * 1.6; seed[i * 4 + 1] = Math.random() * Math.PI * 2
        seed[i * 4 + 2] = (Math.random() - 0.5) * 2.4; seed[i * 4 + 3] = Math.random()
      }
      geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3))
      const mat = new T.PointsMaterial({ size: 0.034, vertexColors: true, map: new T.CanvasTexture(dot), transparent: true, depthWrite: false, sizeAttenuation: true })
      const pts = new T.Points(geo, mat); scene.add(pts)
      const t0 = performance.now()
      let shown = 0
      const loop = () => {
        raf = requestAnimationFrame(loop)
        const s = (performance.now() - t0) / 1000
        // 진행도: 기대 시간에 다가갈수록 1 에 가까워지되 끝나기 전엔 0.92 를 넘지 않는다. 완료되면 빠르게 1 로
        const goal = doneRef.current ? 1 : Math.min(0.92, 1 - Math.exp(-s / (expected / 2.2)))
        shown += (goal - shown) * (doneRef.current ? 0.08 : 0.03)
        for (let i = 0; i < N; i++) {
          // 순서(seed)가 진행도보다 앞선 알갱이부터 하나씩 자리 잡는다
          const k = Math.min(1, Math.max(0, (shown * 1.15 - seed[i * 4 + 3] * 0.95) * 4))
          const e = k * k * (3 - 2 * k)
          const r = seed[i * 4] * (1 - 0.25 * shown), a = seed[i * 4 + 1] + s * (0.5 + 0.6 / r)
          const sx = Math.cos(a) * r, sz = Math.sin(a) * r * 0.6, sy = seed[i * 4 + 2] + Math.sin(s * 1.3 + i) * 0.05
          const j = (1 - e) * 0.02 + 0.004
          pos[i * 3] = sx + (target.pos[i * 3] - sx) * e + (Math.random() - 0.5) * j
          pos[i * 3 + 1] = sy + (target.pos[i * 3 + 1] - sy) * e + (Math.random() - 0.5) * j
          pos[i * 3 + 2] = sz + (target.pos[i * 3 + 2] - sz) * e + (Math.random() - 0.5) * j
          col[i * 3] = SAND[0] + (target.col[i * 3] - SAND[0]) * e
          col[i * 3 + 1] = SAND[1] + (target.col[i * 3 + 1] - SAND[1]) * e
          col[i * 3 + 2] = SAND[2] + (target.col[i * 3 + 2] - SAND[2]) * e
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true
        pts.rotation.y = Math.sin(s * 0.35) * 0.55
        renderer.render(scene, cam)
      }
      loop()
      const onResize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix() }
      window.addEventListener('resize', onResize)
      cleanup = () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); renderer.domElement.remove() }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(() => {})
    return () => { stop = true; cleanup() }
  }, [image, expected])

  return <div ref={box} className="absolute inset-0" aria-hidden />
}
