'use client'
// 3D 모델 생성 — 이미지 업로드 · 글 · 내 드라이브 이미지 · 갤러리 이미지 GLB. 완성되면 돌려 보고 ‘드라이브에 저장’ 또는 ‘버리기’를 고른다.
import { useEffect, useRef, useState } from 'react'
import { GlbViewer, shrink } from './GlbViewer'
import SandForm from './SandForm'
import { fieldSay } from './ParticleField'
import { MotionChips, RigButton } from './RigControls'
import { ui, isImage, type DriveFile, type Source3D } from './shared'

type Mode = 'image' | 'text' | 'drive'
interface Preview { url: string; thumb: string | null; ref?: string | null; title: string; rigged?: boolean }

export default function Model3D({ source, onSaved }: { source: Source3D | null; onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>('image')
  const [image, setImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [pick, setPick] = useState<Source3D | null>(null)
  const [driveImgs, setDriveImgs] = useState<DriveFile[] | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  const [volExtra, setVolExtra] = useState(2)
  const [volumize, setVolumize] = useState(true)
  const [rig, setRig] = useState(true)
  const [rigExtra, setRigExtra] = useState(3)
  const [job, setJob] = useState<{ status: string; elapsed?: number; stage?: string } | null>(null)
  const [result, setResult] = useState<{ token: string; preview: Preview } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [published, setPublished] = useState<string | null>(null)
  const [motion, setMotion] = useState('idle')
  const [bodyType, setBodyType] = useState<'biped' | 'quad' | 'prop'>('biped')
  const [viewBody, setViewBody] = useState('biped')
  const [riggedUrl, setRiggedUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [anim, setAnim] = useState<{ src: string | null; expected: number } | null>(null)   // 모래 효과: 원본 이미지 · 예상 시간
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetch('/api/gallery/model3d?info=1').then((r) => r.json()).then((j) => { setCost(j.cost ?? null); if (typeof j.volumizeExtra === 'number') setVolExtra(j.volumizeExtra); if (typeof j.rigExtra === 'number') setRigExtra(j.rigExtra) }).catch(() => {}) }, [])
  // 다른 화면(드라이브·이미지 생성·갤러리)에서 넘어온 원본
  useEffect(() => { if (!source) return; const t = setTimeout(() => { setPick(source); setMode('drive'); setTitle(source.kind === 'drive' ? source.name.replace(/\.[a-z0-9]+$/i, '') : source.title) }, 0); return () => clearTimeout(t) }, [source])
  useEffect(() => {
    if (mode !== 'drive' || driveImgs) return
    // 드라이브의 이미지 — 맨 위 + 각 폴더
    ;(async () => {
      const top = await fetch('/api/designer/drive').then((r) => r.json()).catch(() => ({ files: [], folders: [] }))
      const sub = await Promise.all((top.folders ?? []).slice(0, 12).map((f: { name: string }) => fetch('/api/designer/drive?folder=' + encodeURIComponent(f.name)).then((r) => r.json()).then((j) => j.files ?? []).catch(() => [])))
      setDriveImgs([...(top.files ?? []), ...sub.flat()].filter((f: DriveFile) => isImage(f.name)).slice(0, 120))
    })()
  }, [mode, driveImgs])

  const busy = !!job
  const ready = mode === 'image' ? !!image : mode === 'text' ? prompt.trim().length >= 2 : !!pick
  const start = async () => {
    if (result && !saved && !confirm('지금 모델을 저장하지 않았어요. 버리고 새로 만들까요?')) return
    if (result && !saved) discard(true)
    setErr(null); setResult(null); setSaved(null); setSavedKey(null); setPublished(null); setRiggedUrl(null); setMotion('idle'); setJob({ status: 'submitting' }); fieldSay({ busy: true })
    setAnim({ src: mode === 'image' ? image : mode === 'drive' ? pick?.url ?? null : null, expected: (mode === 'text' || volumize ? 120 : 60) + (rig ? 110 : 0) })
    const body = mode === 'text' ? { mode: 'text', prompt, title, rig, body: bodyType } : mode === 'image' ? { mode: 'image', image, title, volumize, rig, body: bodyType }
      : pick?.kind === 'drive' ? { mode: 'drive', driveKey: pick.key, title, volumize, rig, body: bodyType } : { mode: 'media', assetId: pick?.kind === 'media' ? pick.id : '', title, volumize, rig, body: bodyType }
    const r = await fetch('/api/gallery/model3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { fieldSay({ busy: false }); setJob(null); setErr(j.error ?? '요청 실패'); return }
    for (let i = 0; i < 300; i++) {
      await new Promise((ok) => setTimeout(ok, 4000))
      const s = await fetch('/api/gallery/model3d?token=' + encodeURIComponent(j.token)).then((x) => x.json()).catch(() => null)
      if (!s) continue
      if (s.status === 'done') { fieldSay({ busy: false }); setJob(null); setResult({ token: j.token, preview: s.preview }); setTitle((t) => t || s.preview.title); if (s.preview.rigged) setMotion('all'); return }
      if (s.status === 'failed') { fieldSay({ busy: false }); setJob(null); setErr(s.error); return }
      setJob({ status: s.status, elapsed: s.elapsed, stage: s.stage })
    }
    setJob(null); setErr('시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.')
  }
  const save = async () => {
    if (!result) return
    const r = await fetch('/api/gallery/model3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', token: result.token, title }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(j.error ?? '저장 실패'); return }
    setSaved(j.name); setSavedKey(j.key); onSaved()
  }
  const publish = async () => {
    if (!savedKey) return
    const r = await fetch('/api/designer/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', key: savedKey, title: title || saved?.replace(/\.glb$/i, ''), tags: '3D', description: mode === 'text' ? prompt : '' }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(j.error ?? '공개 신청 실패'); return }
    setPublished(j.asset?.status === 'active' ? '전체 갤러리 ‘3D 모델’ 에 공개했어요' : '공개 신청했어요 — 관리자 승인 후 전체 갤러리 ‘3D 모델’ 에 보여요')
  }
  const discard = async (silent = false) => {
    if (!result) return
    if (!silent && !confirm('이 모델을 버릴까요? 다시 볼 수 없어요.')) return
    await fetch('/api/gallery/model3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discard', token: result.token }) })
    if (!silent) setResult(null)
  }

  const tab = (m: Mode, label: string) => <button type="button" onClick={() => setMode(m)} className={ui.chip(mode === m)}>{label}</button>
  const status = job ? (job.status === 'submitting' ? '요청 보내는 중…' : job.stage === 'volumize' ? `${mode === 'text' ? '설명대로 그리는 중' : '입체 모습 그리는 중'}… ${job.elapsed ?? 0}초` : job.stage === 'rig' ? `뼈대·움직임 넣는 중… ${job.elapsed ?? 0}초` : `3D 모델 만드는 중… ${job.elapsed ?? 0}초`) : ''
  const total = (cost ?? 0) + (mode === 'text' || volumize ? volExtra : 0) + (rig ? rigExtra : 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5">
      <div className={`${ui.card} p-4 space-y-3 self-start lg:sticky lg:top-4`}>
        <div className="flex flex-wrap gap-1.5">{tab('image', '이미지 올리기')}{tab('text', '글로 설명')}{tab('drive', '드라이브·갤러리')}</div>
        {mode === 'image' && (
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) setImage(await shrink(f)) }}
            className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-[#dfe3f5] hover:border-[#4f46e5] bg-[#f6f8ff] flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image ? <img src={image} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-center text-[#8a90b2] text-[13px] leading-relaxed">이미지를 끌어 놓거나 눌러서 고르세요<br /><span className="text-[11.5px]">물체 하나가 정면으로, 배경이 단순할수록 잘 나와요</span></span>}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await shrink(f)); e.target.value = '' }} />
        {mode === 'text' && <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 200))} rows={5} placeholder="예) 빨간 망토를 두른 귀여운 꼬마 마법사, 큰 눈, 별 모양 지팡이" className={`${ui.input} h-auto py-3 resize-none`} />}
        {mode === 'drive' && (
          <div>
            {pick && (
              <div className="flex items-center gap-2.5 mb-2 p-2 rounded-xl bg-[#eef4ff] border border-[#c7d7fb]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pick.url} alt="" className={`w-12 h-12 rounded-lg object-contain ${ui.checker}`} />
                <p className="text-[12.5px] font-bold text-[#1e3a8a] truncate">{pick.kind === 'drive' ? pick.name : pick.title}<span className="block text-[11px] font-normal text-[#6b7fb3]">{pick.kind === 'drive' ? '내 드라이브' : '갤러리'}</span></p>
              </div>
            )}
            <div className="h-[230px] overflow-y-auto rounded-xl bg-[#f6f8ff] border border-[#e3e7f6] p-2 grid grid-cols-4 gap-1.5 content-start">
              {driveImgs === null ? <p className="col-span-full text-center text-[#8a90b2] text-[12.5px] py-10">불러오는 중…</p>
                : driveImgs.length === 0 ? <p className="col-span-full text-center text-[#8a90b2] text-[12.5px] py-10">드라이브에 이미지가 없어요.<br />갤러리 검색에서 ‘3D로’ 를 눌러도 돼요.</p>
                : driveImgs.map((f) => (
                  <button key={f.key} type="button" onClick={() => { setPick({ kind: 'drive', key: f.key, url: f.url, name: f.name }); setTitle(f.name.replace(/\.[a-z0-9]+$/i, '')) }} title={f.name}
                    className={`aspect-square rounded-lg bg-white border-2 overflow-hidden ${pick?.kind === 'drive' && pick.key === f.key ? 'border-[#4f46e5]' : 'border-transparent hover:border-[#a5b4fc]'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.name} loading="lazy" className="w-full h-full object-contain" />
                  </button>
                ))}
            </div>
          </div>
        )}
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="모델 이름 (선택) — 무엇인지 적으면 입체 모양을 더 잘 잡아요" className={ui.input} />
        <div>
          <p className="text-[12px] font-extrabold text-[#4b5277] mb-1.5">체형 <span className="font-normal text-[#8a90b2]">— 움직이는 캐릭터면 뼈대·움직임·표정까지 넣어요 (+{rigExtra} 프롬코인)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {([['biped', '두 발 (사람형)'], ['quad', '네 발 (동물)'], ['prop', '소품 (움직임 없음)']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setBodyType(v); setRig(v !== 'prop') }} className={ui.chip(bodyType === v)}>{l}</button>
            ))}
          </div>
          <p className="mt-1 text-[11.5px] text-[#8a90b2]">{bodyType === 'biped' ? '걷기·달리기·점프·앉기·옆걸음·말하기 + 칼·방패·양손검·총 동작, 쓰러지기까지 들어가요.' : bodyType === 'quad' ? '네 발 걷기·달리기, 물기 공격, 점프, 꼬리 흔들기, 쓰러지기가 들어가요. 네 다리가 잘 보이게 비스듬한 앞모습으로 만들어요.' : '칼·나무·집 같은 물건 — 뼈대 없이 모양만 만들어요.'}</p>
        </div>
        {mode !== 'text' && (
          <label className="flex items-start gap-2 text-[13px] text-[#3b4166] cursor-pointer select-none">
            <input type="checkbox" checked={volumize} onChange={(e) => setVolumize(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#4f46e5]" />
            <span><b>입체로 다시 그려서 만들기</b> <span className="text-[#8a90b2]">+{volExtra} 프롬코인</span><br /><span className="text-[11.5px] text-[#8a90b2]">2D 그림·캐릭터면 켜 두세요. AI 가 얼굴·몸의 둥근 모양을 상상해 피규어처럼 다시 그린 뒤 3D 로 만들어요. 사진·실물 이미지면 꺼도 돼요.</span></span>
          </label>
        )}
        <button type="button" onClick={start} disabled={busy || !ready} className={`${ui.primary} w-full h-12 text-[14px]`}>
          {busy ? status : `3D 모델 만들기${total ? ` · ${total} 프롬코인` : cost === 0 ? ' · 무료' : ''}`}
        </button>
        {err && <p className="text-[12.5px] text-[#dc2626]">{err}{/부족/.test(err) && <> · <a href="/credits" className="underline">충전</a></>}</p>}
        <p className="text-[11.5px] text-[#8a90b2]">보통 1~2분(처음 한 번은 서버가 켜지느라 3~5분). 실패하면 프롬코인은 자동으로 돌려드려요.</p>
      </div>

      <div className="flex flex-col gap-3 min-h-[420px]">
        {result ? (
          <>
            <div className="relative flex-1 min-h-[420px]">
              <GlbViewer key={riggedUrl ?? result.preview.url} url={riggedUrl ?? result.preview.url} motion={motion} onBody={setViewBody} />
              {result.preview.ref && (
                <figure className="absolute left-3 top-3 w-28 rounded-xl overflow-hidden bg-white border border-[#e3e7f6] shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.preview.ref} alt="" className="w-full aspect-square object-contain" />
                  <figcaption className="px-1.5 py-1 text-[10px] text-[#4b5277] text-center">AI 가 먼저 그린 모습</figcaption>
                </figure>
              )}
            </div>
            <div className={`${ui.card} p-3 flex flex-wrap items-center gap-2`}>
              {saved ? (
                <p className="text-[13.5px] font-bold text-[#15803d] mr-auto">✓ 드라이브 ‘3D 모델’ 폴더에 저장했어요 — {saved}</p>
              ) : (
                <p className="text-[13.5px] font-bold text-[#1f2340] mr-auto">마음에 드나요? <span className="font-normal text-[#8a90b2] text-[12px]">저장하지 않으면 사라져요</span></p>
              )}
              {!saved && <button onClick={save} className={ui.primary}>드라이브에 저장</button>}
              {!saved && <button onClick={() => discard()} className={ui.ghost}>버리기</button>}
              {saved && savedKey && !riggedUrl && !result.preview.rigged && <RigButton driveKey={savedKey} onDone={(f) => { setRiggedUrl(f.url); setSavedKey(f.key); setSaved(f.name); setMotion('all'); onSaved() }} />}
              {saved && !published && <button onClick={publish} className={ui.ghost}>갤러리에 공개 신청</button>}
              <div className="w-full flex items-center gap-2"><span className="text-[12px] font-bold text-[#4b5277]">움직임 미리보기</span><MotionChips value={motion} onChange={setMotion} body={viewBody} /></div>
              {saved && <a href={result.preview.url} download className={ui.ghost}>GLB</a>}
              {published && <p className="w-full text-[12.5px] font-bold text-[#4f46e5]">{published}</p>}
            </div>
          </>
        ) : (
          <div className={`relative flex-1 min-h-[420px] ${ui.card} flex flex-col items-center justify-center text-center p-6 !bg-white/20 !backdrop-blur-[2px]`}>
            {busy ? (
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <SandForm image={anim?.src} expected={anim?.expected ?? 90} />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-white/95 via-white/70 to-transparent">
                  <p className="text-[14px] font-bold text-[#1f2340]">{status}</p>
                  <p className="mt-0.5 text-[12px] text-[#8a90b2]">모래알이 하나씩 모여 모양을 만들고 있어요 — AI 가 앞·옆·뒤 모양을 추측하는 중</p>
                </div>
              </div>
            )
              : (<><span className="vx-orb" aria-hidden /><p className="mt-2 text-[14px] text-[#4b5277]">완성된 3D 모델이 여기 나타나요 — 드래그로 돌려 보고 저장할지 정하세요</p></>)}
          </div>
        )}
      </div>
    </div>
  )
}
