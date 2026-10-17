'use client'
// 3D 미리보기(three.js GLTFLoader·OrbitControls) · 업로드 이미지 축소 — 디자이너 작업 공간 공용
import { useEffect, useRef, useState } from 'react'

declare global { interface Window { THREE?: Record<string, unknown> & { [k: string]: unknown } } }

// three.js(플랫폼 호스팅) + 애드온(GLTFLoader·OrbitControls) 를 한 번만 불러온다
let threeReady: Promise<void> | null = null
export function loadThree(): Promise<void> {
  if (threeReady) return threeReady
  const add = (src: string) => new Promise<void>((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => no(new Error(src)); document.head.appendChild(s) })
  threeReady = (window.THREE ? Promise.resolve() : add('/vendor/three.min.js')).then(() => (window.THREE?.GLTFLoader ? undefined : add('/vendor/three-addons.js')))
  return threeReady
}

/** GLB 를 돌려 볼 수 있는 미리보기 (마우스 드래그 회전·휠 확대, 자동 회전) */
/** motion 을 주면 THREE.makeAlive 로 움직임을 미리 본다 (뼈대가 있으면 팔다리까지). onRigged: 뼈대가 있는지 알려 준다 */
/** motion='all' 이면 동작을 차례로 돌려 보여 준다 */
export function GlbViewer({ url, motion, onRigged }: { url: string; motion?: string; onRigged?: (rigged: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState<string | null>(null)
  const motionRef = useRef(motion)
  useEffect(() => { motionRef.current = motion }, [motion])
  const riggedCb = useRef(onRigged)
  useEffect(() => { riggedCb.current = onRigged }, [onRigged])
  useEffect(() => {
    let stop = false, raf = 0
    let cleanup = () => {}
    loadThree().then(() => {
      if (stop || !box.current) return
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const T: any = window.THREE, el = box.current
      const w = el.clientWidth, h = el.clientHeight
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(w, h)
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace
      else renderer.outputEncoding = T.sRGBEncoding   // 플랫폼 three.js 는 r149 — 텍스처 색이 흐려지지 않게
      el.appendChild(renderer.domElement)
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, w / h, 0.01, 100)
      scene.add(new T.HemisphereLight(0xffffff, 0x8890a0, 1.6))
      const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 5, 4); scene.add(sun)
      const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.autoRotate = !motionRef.current; ctl.autoRotateSpeed = 1.6
      let alive: any = null, last = performance.now(), lastTrig = 0
      const labelRef = { current: null as string | null }
      new T.GLTFLoader().load(url, (g: any) => {
        if (stop) return
        // 금속 맵 없이 metalness 1(glTF 기본값)인 AI 모델은 환경광이 없으면 검게 보인다 → 비금속으로
        g.scene.traverse((n: any) => { const m = n.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((q: any) => { if (q && q.metalness > 0.5 && !q.metalnessMap) { q.metalness = 0; q.roughness = Math.max(q.roughness || 0, 0.8); q.needsUpdate = true } }) })
        const obj = g.scene, b = new T.Box3().setFromObject(obj), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3())
        obj.position.sub(c); scene.add(obj)
        let bones = 0; obj.traverse((n: any) => { if (n.isBone) bones++ })
        riggedCb.current?.(bones >= 4)
        if (motionRef.current !== undefined && T.makeAlive) alive = T.makeAlive(g)   // gltf 통째로 — 파일에 든 움직임 클립을 쓴다
        const r = Math.max(size.x, size.y, size.z) || 1
        if (motionRef.current !== undefined) cam.position.set(r * 0.9, r * 0.45, r * 1.9)   // 팔다리가 잘 보이게 앞쪽 비스듬히
        else cam.position.set(r * 1.1, r * 0.7, r * 1.6)
        cam.near = r / 100; cam.far = r * 50; cam.updateProjectionMatrix(); ctl.update()
        setLoading(false)
      }, undefined, () => { setErr('모델을 불러오지 못했어요'); setLoading(false) })
      const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix() }
      window.addEventListener('resize', onResize)
      const loop = () => {
        raf = requestAnimationFrame(loop)
        const now = performance.now(), dt = (now - last) / 1000; last = now
        if (alive) {
          let m = motionRef.current ?? 'idle'
          if (m === 'all') {   // 전체 동작 차례로 (각 2.4초)
            const seq = ['idle', 'talk', 'walk', 'run', 'jump', 'attack', 'happy', 'hit'], k = Math.floor(now / 2400) % seq.length
            m = seq[k]
            const nm = ({ idle: '가만히', talk: '말하기', walk: '걷기', run: '달리기', jump: '점프', attack: '공격', happy: '기쁨', hit: '맞기' } as Record<string, string>)[m]
            if (nm !== labelRef.current) { labelRef.current = nm; setLabel(nm) }
          } else if (labelRef.current) { labelRef.current = null; setLabel(null) }
          if (['attack', 'hit', 'happy', 'spin'].includes(m)) { if (now - lastTrig > 1100) { alive.trigger(m); lastTrig = now } alive.update(dt, 'idle') }
          else alive.update(dt, m === 'jump' ? (Math.floor(now / 700) % 2 ? 'jump' : 'idle') : m)
        }
        ctl.update(); renderer.render(scene, cam)
      }
      loop()
      cleanup = () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); ctl.dispose(); renderer.dispose(); renderer.domElement.remove() }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(() => setErr('3D 엔진을 불러오지 못했어요'))
    return () => { stop = true; cleanup() }
  }, [url])
  return (
    <div ref={box} className="relative w-full h-full min-h-[280px] rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#ffffff,#e4e8f0)] overflow-hidden cursor-grab active:cursor-grabbing">
      {label && <span className="absolute left-3 top-3 z-10 text-[12.5px] font-extrabold bg-[#241f17]/85 text-white rounded-full px-3 py-1">▶ {label}</span>}
      {loading && !err && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-[#9d9280]">모델 불러오는 중…</p>}
      {err && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-[#f87171]">{err}</p>}
    </div>
  )
}

// 업로드 이미지는 브라우저에서 1024px 이하로 줄여 보낸다 — 투명 배경은 살린다(WEBP, 안 되면 PNG)
export async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1024 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const webp = c.toDataURL('image/webp', 0.92)
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png')
}
