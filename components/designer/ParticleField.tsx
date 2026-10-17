'use client'
// 디자인 AI 배경 — 밝은 빛의 세계. 작은 빛 입자 수천 개가 물결처럼 흐르다가 구·고리·파도·은하·큐브로 차례로 모였다 흩어진다.
// 모양 바꾸기는 GPU(셰이더)에서 두 모양 사이를 섞어 가볍게. 마우스 근처 입자는 살짝 비켜난다. 동작 줄이기 설정·숨은 탭에선 멈춘다.
// 화면과 대화한다: window 'vx-field' 이벤트 — {word:'DRIVE'} 빛 글자로 모임 · {busy:true} 만드는 중엔 뛰는 핵으로 모임 · {busy:false} 끝나면 터지며 흩어짐
let pending: { word?: string; busy?: boolean } = {}   // 입자가 아직 준비 전이면 마지막 요청을 들고 있다가 준비되면 적용
let ready = false
export function fieldSay(detail: { word?: string; busy?: boolean; burst?: boolean }) {
  if (typeof window === 'undefined') return
  if (!ready) { pending = { ...pending, ...detail }; return }
  window.dispatchEvent(new CustomEvent('vx-field', { detail }))
}

function textShape(word: string, n: number): Float32Array {
  const c = document.createElement('canvas'); c.width = 900; c.height = 220
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'; g.font = '900 170px ui-sans-serif, system-ui, -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(word, 450, 115)
  const d = g.getImageData(0, 0, 900, 220).data, pts: number[] = []
  for (let y = 0; y < 220; y += 2) for (let x = 0; x < 900; x += 2) if (d[(y * 900 + x) * 4 + 3] > 128) pts.push(x, y)
  const a = new Float32Array(n * 3), m = pts.length / 2 || 1
  for (let i = 0; i < n; i++) {
    const k = ((Math.random() * m) | 0) * 2
    a[i * 3] = ((pts[k] ?? 450) - 450) / 900 * 3.6; a[i * 3 + 1] = -((pts[k + 1] ?? 110) - 110) / 900 * 3.6; a[i * 3 + 2] = (Math.random() - 0.5) * 0.12
  }
  return a
}
function coreShape(n: number): Float32Array {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), r = 0.42 * Math.cbrt(Math.random()) + (i % 5 === 0 ? 0.25 : 0); a[i * 3] = r * Math.sin(v) * Math.cos(u); a[i * 3 + 1] = r * Math.cos(v); a[i * 3 + 2] = r * Math.sin(v) * Math.sin(u) }
  return a
}
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
uniform float uMix; uniform float uTime; uniform vec2 uMouse; uniform float uSize; uniform float uBurst; uniform float uPulse; uniform float uCalm;
varying float vSeed; varying float vAlpha;
void main() {
  float k = smoothstep(0.0, 1.0, clamp(uMix * 1.35 - seed * 0.35, 0.0, 1.0));
  vec3 p = mix(position, posB, k);
  // 흐르는 물결(옮겨 가는 중엔 크게 흩날린다)
  float fl = (0.06 + 0.55 * sin(k * 3.14159)) * (1.0 - uCalm * 0.85);
  p *= 1.0 + uPulse * 0.07 * sin(uTime * 7.0 + seed * 2.0);
  p += normalize(p + 1e-4) * uBurst * (0.4 + seed) * 1.6;
  p += fl * vec3(sin(uTime * 0.7 + p.y * 2.3 + seed * 9.0), cos(uTime * 0.6 + p.z * 2.1 + seed * 7.0), sin(uTime * 0.5 + p.x * 1.9 + seed * 5.0)) * (0.3 + seed * 0.7);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  // 마우스 근처는 비켜난다
  vec2 ndc = clip.xy / clip.w; vec2 d = ndc - uMouse; float m = exp(-dot(d, d) * 28.0);
  clip.xy += normalize(d + 1e-4) * m * 0.09 * clip.w;
  gl_Position = clip;
  gl_PointSize = uSize * (0.55 + seed) / -mv.z;
  vSeed = seed; vAlpha = 0.12 + 0.26 * seed;   // 연하게 — 글씨가 잘 보이도록
}`
const FRAG = `
varying float vSeed; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5; float r = length(c);   // 둥근 입자
  if (r > 0.5) discard;
  // 여러 빛깔: 씨앗 값으로 색상환을 돈다(무지개 파스텔보다 조금 진하게)
  // 파랑 계열로 좁힌 빛깔: 하늘·파랑·남보라
  vec3 sky = vec3(0.22, 0.74, 0.97), blue = vec3(0.15, 0.39, 0.92), ind = vec3(0.49, 0.36, 0.96);
  vec3 col = vSeed < 0.5 ? mix(sky, blue, vSeed * 2.0) : mix(blue, ind, (vSeed - 0.5) * 2.0);
  gl_FragColor = vec4(col, vAlpha * smoothstep(0.5, 0.15, r));
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
      const uni = { uMix: { value: 0 }, uTime: { value: 0 }, uMouse: { value: new T.Vector2(9, 9) }, uSize: { value: 19 * Math.min(1.75, window.devicePixelRatio) }, uBurst: { value: 0 }, uPulse: { value: 0 }, uCalm: { value: 0 } }
      const mat = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, transparent: true, depthWrite: false })
      const pts = new T.Points(geo, mat); scene.add(pts)
      // 오른쪽에 두어 왼쪽 메뉴·글과 겹치지 않게
      // 평소 자리 / 만드는 중엔 오른쪽 위 작은 심장
      const home = { x: 0, y: 0, s: 1 }, heart = { x: 0, y: 0, s: 0.3 }
      const place = () => {
        const wide = el.clientWidth > 900
        home.x = wide ? 0.9 : 0; home.y = wide ? 0 : 0.4; home.s = wide ? 1.45 : 1.1
        const vh = 2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.z, vw = vh * cam.aspect
        heart.x = vw / 2 - 0.38; heart.y = vh / 2 - 0.42 - cam.position.y; heart.s = wide ? 0.2 : 0.16
      }
      place()
      pts.position.set(home.x, home.y, 0); pts.scale.setScalar(home.s)
      const onMove = (e: PointerEvent) => { uni.uMouse.value.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1) }
      const onResize = () => { renderer.setSize(el.clientWidth, el.clientHeight); cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); place() }
      window.addEventListener('pointermove', onMove); window.addEventListener('resize', onResize)
      let last = performance.now(), hold = 0, morph = false, holdFor = 5.5, busy = false, special = false
      const HOLD = 5.5, MORPH = 3.2
      // 지금 보이는 자리에서 새 목표로 (모양 중간이어도 자연스럽게 이어진다)
      const goTo = (target: Float32Array, holdSec: number, isSpecial: boolean) => {
        const A = geo.attributes.position.array as Float32Array, Bv = geo.attributes.posB.array as Float32Array
        const m = uni.uMix.value * uni.uMix.value * (3 - 2 * uni.uMix.value)
        for (let i = 0; i < A.length; i++) A[i] = A[i] + (Bv[i] - A[i]) * m
        Bv.set(target); geo.attributes.position.needsUpdate = true; geo.attributes.posB.needsUpdate = true
        uni.uMix.value = 0; morph = true; hold = 0; holdFor = holdSec; special = isSpecial
      }
      const onField = (e: Event) => {
        const d = (e as CustomEvent).detail ?? {}
        if (d.busy === true) { el.style.zIndex = '40'; busy = true; goTo(coreShape(N), 1e9, true); uni.uPulse.value = 0 }
        else if (d.busy === false) { setTimeout(() => { el.style.zIndex = '' }, 1600); busy = false; uni.uPulse.value = 0; uni.uBurst.value = 1; next = (cur + 1) % S.length; goTo(S[next], HOLD, false) }
        if (d.burst) uni.uBurst.value = 1
        if (d.word && !busy) goTo(textShape(String(d.word).slice(0, 10).toUpperCase(), N), 4.2, true)
      }
      window.addEventListener('vx-field', onField)
      ready = true
      if (pending.word || pending.busy !== undefined) { const pd = pending; pending = {}; setTimeout(() => onField(new CustomEvent('vx-field', { detail: pd })), 600) }
      const loop = () => {
        raf = requestAnimationFrame(loop)
        if (document.hidden) { last = performance.now(); return }
        const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now
        uni.uTime.value += dt
        // 글자·핵일 땐 정면을 보고 고요하게, 평소엔 천천히 돈다
        // 자리·크기: 만드는 중이면 오른쪽 위로 작게, 심장처럼 두 번씩 뛴다(쿵-쿵 … 쉼)
        {
          const tgt = busy ? heart : home, k = Math.min(1, dt * 2.2)
          pts.position.x += (tgt.x - pts.position.x) * k; pts.position.y += (tgt.y - pts.position.y) * k
          let sc = tgt.s
          if (busy) { const ph = (uni.uTime.value % 1.1) / 1.1; const beat = Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.28) / 0.05, 2)); sc *= 1 + 0.22 * beat }
          const cs = pts.scale.x; pts.scale.setScalar(cs + (sc - cs) * (busy ? Math.min(1, dt * 12) : k))
        }
        if (special) { const ry = ((pts.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; pts.rotation.y = ry * (1 - Math.min(1, dt * 2.5)); pts.rotation.x *= 1 - Math.min(1, dt * 2.5); uni.uCalm.value = Math.min(1, uni.uCalm.value + dt * 1.5) }
        else { pts.rotation.y += dt * 0.08; pts.rotation.x = Math.sin(uni.uTime.value * 0.15) * 0.18; uni.uCalm.value = Math.max(0, uni.uCalm.value - dt) }
        uni.uBurst.value = Math.max(0, uni.uBurst.value - dt * 1.4)
        if (!morph) { hold += dt; if (hold > holdFor && !busy) { special = false; next = (cur + 1) % S.length; goTo(S[next], HOLD, false) } }
        else {
          uni.uMix.value = Math.min(1, uni.uMix.value + dt / (busy ? 1.1 : MORPH))
          if (uni.uMix.value >= 1) {   // 도착: 지금 모양 = 도착한 모양
            const A = geo.attributes.position.array as Float32Array; A.set(geo.attributes.posB.array as Float32Array); geo.attributes.position.needsUpdate = true
            if (!special) cur = next
            uni.uMix.value = 0; morph = false; hold = 0
          }
        }
        renderer.render(scene, cam)
      }
      loop()
      cleanup = () => { ready = false; window.removeEventListener('vx-field', onField); window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); renderer.domElement.remove() }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(() => {})
    return () => { stop = true; cleanup() }
  }, [])
  // 마우스를 따라 흩날리는 빛 꼬리 (2D 캔버스 — 가볍게)
  const trail = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !trail.current) return
    const c = trail.current, g = c.getContext('2d')!
    let raf = 0; const P: { x: number; y: number; vx: number; vy: number; l: number; h: number }[] = []
    const size = () => { c.width = window.innerWidth * devicePixelRatio; c.height = window.innerHeight * devicePixelRatio }
    size()
    let lx = -1, ly = -1
    const mv = (e: PointerEvent) => {
      const x = e.clientX * devicePixelRatio, y = e.clientY * devicePixelRatio
      const n = lx < 0 ? 1 : Math.min(6, 1 + Math.hypot(x - lx, y - ly) / 14)
      for (let i = 0; i < n; i++) P.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8 - 0.3, l: 1, h: Math.random() })
      if (P.length > 240) P.splice(0, P.length - 240)
      lx = x; ly = y
    }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      g.clearRect(0, 0, c.width, c.height)
      for (const p of P) {
        p.x += p.vx * devicePixelRatio; p.y += p.vy * devicePixelRatio; p.l -= 0.022
        if (p.l <= 0) continue
        const r = (1.2 + 2.2 * p.l) * devicePixelRatio
        g.fillStyle = `hsla(${Math.round(200 + p.h * 60)},85%,60%,${(p.l * 0.4).toFixed(3)})`
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill()
      }
      for (let i = P.length - 1; i >= 0; i--) if (P[i].l <= 0) P.splice(i, 1)
    }
    loop()
    window.addEventListener('pointermove', mv); window.addEventListener('resize', size)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', mv); window.removeEventListener('resize', size) }
  }, [])
  return (
    <>
      <div ref={box} className="fixed inset-0 z-0 pointer-events-none" aria-hidden />
      <canvas ref={trail} className="fixed inset-0 z-[60] pointer-events-none w-full h-full" aria-hidden />
    </>
  )
}
