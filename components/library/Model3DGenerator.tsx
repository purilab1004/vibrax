'use client'
// 갤러리 3D 생성기 — 이미지·글·내 미디어 이미지 → 3D 모델(GLB). 완성되면 미디어 라이브러리(3D 모델)에 등록되어 게임 만들기에 바로 쓸 수 있다.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Mode = 'image' | 'text' | 'media'
interface M3D { id: string; name: string; title: string; url: string; bytes: number; meta?: { thumb?: string | null; source?: string } }
interface MediaImg { id: string; title: string; url: string; kind: string }
declare global { interface Window { THREE?: Record<string, unknown> & { [k: string]: unknown } } }

// three.js(플랫폼 호스팅) + 애드온(GLTFLoader·OrbitControls) 를 한 번만 불러온다
let threeReady: Promise<void> | null = null
function loadThree(): Promise<void> {
  if (threeReady) return threeReady
  const add = (src: string) => new Promise<void>((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => no(new Error(src)); document.head.appendChild(s) })
  threeReady = (window.THREE ? Promise.resolve() : add('/vendor/three.min.js')).then(() => (window.THREE?.GLTFLoader ? undefined : add('/vendor/three-addons.js')))
  return threeReady
}

/** GLB 를 돌려 볼 수 있는 미리보기 (마우스 드래그 회전·휠 확대, 자동 회전) */
export function GlbViewer({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
      el.appendChild(renderer.domElement)
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(40, w / h, 0.01, 100)
      scene.add(new T.HemisphereLight(0xffffff, 0x334466, 1.4))
      const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 5, 4); scene.add(sun)
      const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 1.6
      new T.GLTFLoader().load(url, (g: any) => {
        if (stop) return
        const obj = g.scene, b = new T.Box3().setFromObject(obj), size = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3())
        obj.position.sub(c); scene.add(obj)
        const r = Math.max(size.x, size.y, size.z) || 1
        cam.position.set(r * 1.1, r * 0.7, r * 1.6); cam.near = r / 100; cam.far = r * 50; cam.updateProjectionMatrix(); ctl.update()
        setLoading(false)
      }, undefined, () => { setErr('모델을 불러오지 못했어요'); setLoading(false) })
      const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix() }
      window.addEventListener('resize', onResize)
      const loop = () => { raf = requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam) }
      loop()
      cleanup = () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); ctl.dispose(); renderer.dispose(); renderer.domElement.remove() }
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }).catch(() => setErr('3D 엔진을 불러오지 못했어요'))
    return () => { stop = true; cleanup() }
  }, [url])
  return (
    <div ref={box} className="relative w-full h-full min-h-[280px] rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#2a2350,#0b0a12)] overflow-hidden cursor-grab active:cursor-grabbing">
      {loading && !err && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/50">모델 불러오는 중…</p>}
      {err && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-[#f87171]">{err}</p>}
    </div>
  )
}

// 업로드 이미지는 브라우저에서 1024px 이하 JPEG 로 줄여 보낸다
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1024 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.9)
}

export default function Model3DGenerator({ loggedIn }: { loggedIn: boolean }) {
  const [mode, setMode] = useState<Mode>('image')
  const [image, setImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [pbr, setPbr] = useState(false)
  const [media, setMedia] = useState<MediaImg[] | null>(null)
  const [pick, setPick] = useState<MediaImg | null>(null)
  const [mine, setMine] = useState<M3D[]>([])
  const [job, setJob] = useState<{ status: string; elapsed?: number; position?: number | null } | null>(null)
  const [result, setResult] = useState<M3D | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [price, setPrice] = useState<{ cost: number; pbr: boolean }>({ cost: 3, pbr: false })
  const cost = price.cost + (price.pbr && pbr ? 5 : 0)

  useEffect(() => { if (loggedIn) fetch('/api/gallery/model3d?mine=1').then((r) => r.json()).then((j) => { setMine(j.items ?? []); if (typeof j.cost === 'number') setPrice({ cost: j.cost, pbr: !!j.pbr }) }).catch(() => {}) }, [loggedIn])
  useEffect(() => {
    if (mode !== 'media' || media) return
    fetch('/api/library?kind=character').then((r) => r.json()).then(async (a) => {
      const b = await fetch('/api/library?kind=item').then((r) => r.json()).catch(() => ({ items: [] }))
      setMedia([...(a.items ?? []), ...(b.items ?? [])].slice(0, 60))
    }).catch(() => setMedia([]))
  }, [mode, media])

  const busy = !!job && job.status !== 'failed'
  const ready = mode === 'image' ? !!image : mode === 'text' ? prompt.trim().length >= 2 : !!pick
  const start = async () => {
    if (!loggedIn) { location.href = '/login?redirect=/gallery'; return }
    setErr(null); setResult(null); setJob({ status: 'submitting' })
    const r = await fetch('/api/gallery/model3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, image, prompt, assetId: pick?.id, pbr, title: title || pick?.title }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setJob(null); setErr(j.error ?? '요청 실패'); return }
    const token = j.token as string
    for (let i = 0; i < 300; i++) {
      await new Promise((ok) => setTimeout(ok, 4000))
      const s = await fetch('/api/gallery/model3d?token=' + encodeURIComponent(token)).then((x) => x.json()).catch(() => null)
      if (!s) continue
      if (s.status === 'done') { setJob(null); setResult(s.asset); setMine((m) => [s.asset, ...m.filter((x) => x.id !== s.asset.id)]); return }
      if (s.status === 'failed') { setJob(null); setErr(s.error); return }
      setJob({ status: s.status, elapsed: s.elapsed, position: s.position })
    }
    setJob(null); setErr('시간이 오래 걸리고 있어요. 잠시 후 "내 3D 모델" 에서 확인해 주세요.')
  }
  const copyName = async (n: string) => { try { await navigator.clipboard.writeText(n); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* 무시 */ } }

  const tab = (m: Mode, label: string) => <button type="button" onClick={() => setMode(m)} className={`h-9 px-4 rounded-full text-[13px] font-bold transition-colors ${mode === m ? 'bg-white text-[#0b0a12]' : 'text-white/60 hover:text-white bg-white/[0.06]'}`}>{label}</button>
  const status = job ? (job.status === 'submitting' ? '요청 보내는 중…' : job.status === 'queued' ? `대기 중${job.position != null ? ` (앞에 ${job.position}개)` : ''}…` : `3D 모델 만드는 중… ${job.elapsed ?? 0}초`) : ''

  return (
    <section className="rounded-3xl bg-white/[0.05] border border-white/10 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.25em] text-[#c4b5fd]">AI 3D GENERATOR</p>
          <h2 className="mt-1 text-[22px] md:text-[26px] font-black">3D 모델 만들기</h2>
          <p className="mt-1 text-[13px] text-white/55">이미지나 글로 설명하면 AI 가 3D 모델(GLB)을 만들어요. 완성된 모델은 미디어 라이브러리에 등록되어 게임 만들기에 바로 쓸 수 있어요.</p>
        </div>
        <div className="flex gap-1.5">{tab('image', '🖼 이미지 → 3D')}{tab('text', '✍ 텍스트 → 3D')}{tab('media', '🎨 내 미디어 → 3D')}</div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* 입력 */}
        <div className="space-y-3">
          {mode === 'image' && (
            <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) setImage(await shrink(f)) }}
              className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-white/15 hover:border-[#a78bfa]/70 bg-white/[0.03] flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? <img src={image} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-center text-white/50 text-[13px] leading-relaxed">🖼<br />이미지를 끌어 놓거나 눌러서 고르세요<br /><span className="text-white/35 text-[11.5px]">한 가지 물체가 정면으로, 배경이 단순할수록 잘 나와요</span></span>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await shrink(f)); e.target.value = '' }} />
          {mode === 'text' && (
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 200))} rows={5} placeholder="예) 귀여운 초록 슬라임 몬스터, 큰 눈, 카툰 스타일"
              className="w-full rounded-2xl bg-white/[0.06] border border-white/10 focus:border-[#a78bfa]/70 p-4 text-[14px] text-white outline-none placeholder:text-white/35 resize-none" />
          )}
          {mode === 'media' && (
            <div className="h-[260px] overflow-y-auto rounded-2xl bg-white/[0.03] border border-white/10 p-2 grid grid-cols-4 sm:grid-cols-5 gap-2 content-start">
              {media === null ? <p className="col-span-full text-center text-white/45 text-[13px] py-10">불러오는 중…</p>
                : media.length === 0 ? <p className="col-span-full text-center text-white/45 text-[13px] py-10">고를 수 있는 캐릭터·아이템 이미지가 없어요</p>
                : media.map((m) => (
                  <button key={m.id} type="button" onClick={() => setPick(m)} title={m.title} className={`aspect-square rounded-xl bg-white/[0.05] border-2 overflow-hidden flex items-center justify-center ${pick?.id === m.id ? 'border-[#a78bfa]' : 'border-transparent hover:border-white/20'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.title} loading="lazy" className="max-w-full max-h-full object-contain" />
                  </button>
                ))}
            </div>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="모델 이름 (선택)" className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 focus:border-[#a78bfa]/70 px-4 text-[13.5px] text-white outline-none placeholder:text-white/35" />
          {price.pbr && <label className="flex items-center gap-2 text-[13px] text-white/70 select-none cursor-pointer">
            <input type="checkbox" checked={pbr} onChange={(e) => setPbr(e.target.checked)} className="accent-[#a78bfa] w-4 h-4" />
            고품질 재질(PBR — 금속·거칠기) <span className="text-white/40">+5 프롬코인</span>
          </label>}
          <button type="button" onClick={start} disabled={busy || !ready}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#ff2d6f] text-white font-black text-[15px] disabled:opacity-40">
            {busy ? status : cost > 0 ? `3D 모델 만들기 · ${cost} 프롬코인` : '3D 모델 만들기 · 무료'}
          </button>
          {err && <p className="text-[12.5px] text-[#f87171]">{err}{/프롬코인이 부족/.test(err) && <> · <a href="/credits" className="underline">충전</a></>}</p>}
          <p className="text-[11.5px] text-white/35">보통 1~2분 걸려요. 실패하면 프롬코인은 자동으로 돌려드려요.</p>
        </div>

        {/* 결과 */}
        <div className="flex flex-col gap-3 min-h-[320px]">
          {result ? (
            <>
              <div className="flex-1 min-h-[320px]"><GlbViewer url={result.url} /></div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-bold mr-auto">{result.title} <span className="text-white/40 text-[12px] font-normal">{(result.bytes / 1048576).toFixed(1)}MB</span></p>
                <a href={result.url} download={`${result.name}.glb`} className="h-9 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[12.5px] font-bold inline-flex items-center">⬇ GLB</a>
                <button type="button" onClick={() => copyName(result.name)} className="h-9 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[12.5px] font-bold">{copied ? '복사됨 ✓' : `이름 복사 · ${result.name}`}</button>
                <Link href="/studio" className="h-9 px-4 rounded-xl bg-[#8b5cf6] text-[12.5px] font-bold inline-flex items-center">게임에 쓰기 →</Link>
              </div>
              <p className="text-[11.5px] text-white/40">스튜디오 미디어 선택기의 ‘3D 모델’ 에서 고르면 3D 게임에 들어가요.</p>
            </>
          ) : (
            <div className="flex-1 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#1d1838,#0b0a12)] flex flex-col items-center justify-center text-center p-6">
              {busy ? (<><div className="w-10 h-10 rounded-full border-[3px] border-white/15 border-t-[#a78bfa] animate-spin" /><p className="mt-4 text-[14px] font-bold">{status}</p><p className="mt-1 text-[12px] text-white/45">AI 가 앞·옆·뒤 모양을 추측해 입체로 만드는 중이에요</p></>)
                : (<><p className="text-[40px]">🧊</p><p className="mt-2 text-[14px] text-white/60">완성된 3D 모델이 여기 나타나요 — 드래그로 돌려 볼 수 있어요</p></>)}
            </div>
          )}
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] font-extrabold text-white/80">내 3D 모델 <span className="text-[#c4b5fd]">{mine.length}</span></p>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {mine.map((m) => (
              <button key={m.id} type="button" onClick={() => setResult(m)} title={m.title} className={`aspect-square rounded-xl bg-white/[0.05] border-2 overflow-hidden flex flex-col items-center justify-center ${result?.id === m.id ? 'border-[#a78bfa]' : 'border-transparent hover:border-white/20'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.meta?.thumb ? <img src={m.meta.thumb} alt={m.title} loading="lazy" className="max-w-full max-h-[80%] object-contain" /> : <span className="text-[28px]">🧊</span>}
                <span className="text-[10.5px] text-white/60 truncate max-w-full px-1">{m.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
