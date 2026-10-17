'use client'
// 디자인 AI 배경 — 밝은 빛의 세계. 작은 빛 입자 수천 개가 물결처럼 흐르다가 구·고리·파도·은하·큐브로 차례로 모였다 흩어진다.
// 모양 바꾸기는 GPU(셰이더)에서 두 모양 사이를 섞어 가볍게. 마우스 근처 입자는 살짝 비켜난다. 동작 줄이기 설정·숨은 탭에선 멈춘다.
import { useEffect, useRef } from 'react'
import { loadThree } from './GlbViewer'

function shapes(n: number): Float32Array[] {
  const make = (fn: (i: number, out: number[]) => void) => { const a = new Float32Array(n * 3); const o = [0, 0, 0]; for (let i = 0; i < n; i++) { fn(i, o); a[i * 3] = o[0]; a[i * 3 + 1] = o[1]; a[i * 3 + 2] = o[2] } return a }
  const R = Math.random
  return [
    // 구 — 표면에 물결
    make((i, o) => { const u = R() * Math.PI * 2, v = Math.acos(2 * R() - 1), r = 1.15 + 0.08 * Math.sin(u * 6) * Math.sin(v * 5); o[0] = r * Math.sin(v) * Math.cos(u); o[1] = r * Math.cos(v); o[2] = r * Math.sin(v) * Math.sin(u) }),
    // 고리(토러스)
    make((i, o) => { const u = R() * Math.PI * 2, v = R() * Math.PI * 2, rr = 0.32 * Math.sqrt(R()); o[0] = (1.15 + rr * Math.cos(v)) * Math.cos(u); o[1] = rr * Math.sin(v) * 1.2; o[2] = (1.15 + rr * Math.cos(v)) * Math.sin(u) }),
    // 파도 면
    make((i, o) => { const x = (R() - 0.5) * 3.6, z = (R() - 0.5) * 2.4; o[0] = x; o[1] = 0.35 * Math.sin(x * 2.1) * Math.cos(z * 2.4) + (R() - 0.5) * 0.05; o[2] = z }),
    // 은하 나선
    make((i, o) => { const arm = i % 3, t = Math.pow(R(), 0.7) * 1.7, a = t * 3.2 + (arm * Math.PI * 2) / 3 + (R() - 0.5) * 0.45; o[0] = Math.cos(a) * t; o[1] = (R() - 0.5) * 0.18 * (1.8 - t); o[2] = Math.sin(a) * t }),
    // 큐브 격자 껍질
    make((i, o) => { const f = (i % 6), a = (R() - 0.5) * 1.7, b = (R() - 0.5) * 1.7, s = f % 2 ? 0.85 : -0.85; const ax = Math.floor(f / 2); const p = [a, b]; const q = [0, 0, 0]; q[ax] = s; q[(ax + 1) % 3] = p[0]; q[(ax + 2) % 3] = p[1]; o[0] = q[0]; o[1] = q[1]; o[2] = q[2] }),
  ]
}

const VERT = `
attribute vec3 posB; attribute float seed;
uniform float uMix; uniform float uTime; uniform vec2 uMouse; uniform float uSize;
varying float vSeed; varying float vAlpha;
void main() {
  float k = smoothstep(0.0, 1.0, clamp(uMix * 1.35 - seed * 0.35, 0.0, 1.0));
  vec3 p = mix(position, posB, k);
  // 흐르는 물결(옮겨 가는 중엔 크게 흩날린다)
  float fl = 0.06 + 0.55 * sin(k * 3.14159);
  p += fl * vec3(sin(uTime * 0.7 + p.y * 2.3 + seed * 9.0), cos(uTime * 0.6 + p.z * 2.1 + seed * 7.0), sin(uTime * 0.5 + p.x * 1.9 + seed * 5.0)) * (0.3 + seed * 0.7);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  // 마우스 근처는 비켜난다
  vec2 ndc = clip.xy / clip.w; vec2 d = ndc - uMouse; float m = exp(-dot(d, d) * 28.0);
  clip.xy += normalize(d + 1e-4) * m * 0.09 * clip.w;
  gl_Position = clip;
  gl_PointSize = uSize * (0.55 + seed) / -mv.z;
  vSeed = seed; vAlpha = 0.35 + 0.55 * seed;
}`
const FRAG = `
varying float vSeed; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5; float r = length(c);
  if (r > 0.5) discard;
  vec3 a = vec3(0.31, 0.27, 0.90), b = vec3(0.02, 0.71, 0.83), v = vec3(0.65, 0.45, 0.98);
  vec3 col = mix(mix(a, b, vSeed), v, smoothstep(0.6, 1.0, vSeed));
  gl_FragColor = vec4(col, vAlpha * smoothstep(0.5, 0.1, r));
}`

export default function ParticleField() {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let stop = false, raf = 0, cleanup = () => {}
    loadThree().then(() => {
      if (stop || !box.current) return
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const T: any = window.THREE, el = box.current
      const N = window.innerWidth < 700 ? 2600 : 6500
      const S = shapes(N)
      const renderer = new T.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio)); renderer.setSize(el.clientWidth, el.clientHeight)
      el.appendChild(renderer.domElement)
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 50)
      cam.position.set(0, 0.25, 4.4)
      const geo = new T.BufferGeometry()
      let cur = 0, next = 1
      geo.setAttribute('position', new T.BufferAttribute(S[cur].slice(), 3))
      geo.setAttribute('posB', new T.BufferAttribute(S[next].slice(), 3))
      const seed = new Float32Array(N); for (let i = 0; i < N; i++) seed[i] = Math.random()
      geo.setAttribute('seed', new T.BufferAttribute(seed, 1))
      const uni = { uMix: { value: 0 }, uTime: { value: 0 }, uMouse: { value: new T.Vector2(9, 9) }, uSize: { value: 15 * Math.min(1.75, window.devicePixelRatio) } }
      const mat = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, transparent: true, depthWrite: false })
      const pts = new T.Points(geo, mat); scene.add(pts)
      // 오른쪽에 두어 왼쪽 메뉴·글과 겹치지 않게
      const place = () => { const wide = el.clientWidth > 900; pts.position.set(wide ? 1.15 : 0, wide ? 0 : 0.6, 0); pts.scale.setScalar(wide ? 1 : 0.8) }
      place()
      const onMove = (e: PointerEvent) => { uni.uMouse.value.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1) }
      const onResize = () => { renderer.setSize(el.clientWidth, el.clientHeight); cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); place() }
      window.addEventListener('pointermove', onMove); window.addEventListener('resize', onResize)
      let last = performance.now(), hold = 0, morph = false
      const HOLD = 5.5, MORPH = 3.2
      const loop = () => {
        raf = requestAnimationFrame(loop)
        if (document.hidden) { last = performance.now(); return }
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now
        uni.uTime.value += dt
        pts.rotation.y += dt * 0.08; pts.rotation.x = Math.sin(uni.uTime.value * 0.15) * 0.18
        if (!morph) { hold += dt; if (hold > HOLD) { morph = true; hold = 0 } }
        else {
          uni.uMix.value = Math.min(1, uni.uMix.value + dt / MORPH)
          if (uni.uMix.value >= 1) {   // 다음 모양으로: 지금 모양 = 도착한 모양, 새 목표
            cur = next; next = (next + 1) % S.length
            geo.attributes.position.array.set(S[cur]); geo.attributes.position.needsUpdate = true
            geo.attributes.posB.array.set(S[next]); geo.attributes.posB.needsUpdate = true
            uni.uMix.value = 0; morph = false
          }
        }
        renderer.render(scene, cam)
      }
      loop()
      cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); renderer.domElement.remove() }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(() => {})
    return () => { stop = true; cleanup() }
  }, [])
  return <div ref={box} className="fixed inset-0 z-0 pointer-events-none" aria-hidden />
}
