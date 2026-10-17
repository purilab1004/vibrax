'use client'
// AI 이미지 생성 — 프롬프트(한국어 가능) + 용도·스타일·비율 → 4장. 마음에 드는 것만 드라이브에 저장하거나 바로 3D 로.
import { useEffect, useState } from 'react'
import { ui, type Source3D } from './shared'

const PRESETS: [string, string, boolean][] = [['character', '🧍 캐릭터', true], ['item', '🗡 아이템', true], ['background', '🏞 배경', false], ['tile', '🧱 타일', false], ['ui', '🔘 UI', true], ['effect', '✨ 이펙트', false], ['free', '자유', false]]
const STYLES: [string, string][] = [['auto', '알아서'], ['cartoon', '카툰'], ['pixel', '픽셀'], ['anime', '애니'], ['3d', '3D 렌더'], ['realistic', '사실적'], ['watercolor', '수채화']]
const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
interface Batch { token: string; prompt: string; images: string[]; saved: Record<number, string> }

export default function ImageGen({ onSaved, onMake3D }: { onSaved: () => void; onMake3D: (s: Source3D) => void }) {
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('character')
  const [style, setStyle] = useState('cartoon')
  const [ratio, setRatio] = useState('1:1')
  const [transparent, setTransparent] = useState(true)
  const [cost, setCost] = useState<number | null>(null)
  const [ready, setReady] = useState(true)
  const [job, setJob] = useState<{ elapsed: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => { fetch('/api/designer/image?info=1').then((r) => r.json()).then((j) => { setCost(j.cost ?? null); setReady(j.ready !== false) }).catch(() => {}) }, [])
  const pickPreset = (p: string) => { setPreset(p); setTransparent(PRESETS.find((x) => x[0] === p)?.[2] ?? false); if (p === 'background') setRatio('9:16') }

  const start = async () => {
    setErr(null); setJob({ elapsed: 0 })
    const r = await fetch('/api/designer/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, preset, style, ratio, transparent }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setJob(null); setErr(j.error ?? '요청 실패'); return }
    for (let i = 0; i < 200; i++) {
      await new Promise((ok) => setTimeout(ok, 3000))
      const s = await fetch('/api/designer/image?token=' + encodeURIComponent(j.token)).then((x) => x.json()).catch(() => null)
      if (!s) continue
      if (s.status === 'done') { setJob(null); setBatches((b) => [{ token: j.token, prompt, images: s.images, saved: {} }, ...b].slice(0, 10)); return }
      if (s.status === 'failed') { setJob(null); setErr(s.error); return }
      setJob({ elapsed: s.elapsed ?? 0 })
    }
    setJob(null); setErr('시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.')
  }
  const save = async (b: Batch, i: number, then3d = false) => {
    let key = b.saved[i]
    if (!key) {
      const r = await fetch('/api/designer/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_image', token: b.token, index: i, name: b.prompt.slice(0, 30) }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? '저장 실패'); return }
      key = j.key
      setBatches((all) => all.map((x) => (x.token === b.token ? { ...x, saved: { ...x.saved, [i]: key } } : x)))
      onSaved()
      if (then3d) onMake3D({ kind: 'drive', key, url: j.url, name: j.name })
    } else if (then3d) onMake3D({ kind: 'drive', key, url: b.images[i], name: b.prompt.slice(0, 30) })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* 입력 */}
      <div className={`${ui.card} p-4 space-y-4 self-start lg:sticky lg:top-4`}>
        <div>
          <p className="text-[12px] font-extrabold text-[#4b5277] mb-1.5">무엇을 그릴까요?</p>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 500))} rows={4} placeholder="예) 불꽃을 두른 아기 드래곤, 큰 눈, 날개를 펼친 모습"
            className={`${ui.input} h-auto py-3 resize-none`} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim().length >= 2 && !job) start() }} />
        </div>
        <div><p className="text-[12px] font-extrabold text-[#4b5277] mb-1.5">용도</p><div className="flex flex-wrap gap-1.5">{PRESETS.map(([v, l]) => <button key={v} onClick={() => pickPreset(v)} className={ui.chip(preset === v)}>{l}</button>)}</div></div>
        <div><p className="text-[12px] font-extrabold text-[#4b5277] mb-1.5">스타일</p><div className="flex flex-wrap gap-1.5">{STYLES.map(([v, l]) => <button key={v} onClick={() => setStyle(v)} className={ui.chip(style === v)}>{l}</button>)}</div></div>
        <div><p className="text-[12px] font-extrabold text-[#4b5277] mb-1.5">비율</p><div className="flex flex-wrap gap-1.5">{RATIOS.map((r) => <button key={r} onClick={() => setRatio(r)} className={ui.chip(ratio === r)}>{r}</button>)}</div></div>
        <label className="flex items-center gap-2 text-[13px] text-[#3b4166] cursor-pointer select-none">
          <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="w-4 h-4 accent-[#4f46e5]" />
          배경 지우기 <span className="text-[11.5px] text-[#8a90b2]">(캐릭터·아이템 스프라이트용 투명 PNG)</span>
        </label>
        <button onClick={start} disabled={!!job || !ready || prompt.trim().length < 2} className={`${ui.primary} w-full h-12 text-[14px]`}>
          {!ready ? '이미지 생성 준비 중이에요' : job ? `그리는 중… ${job.elapsed}초` : `이미지 4장 만들기${cost ? ` · ${cost} 프롬코인` : cost === 0 ? ' · 무료' : ''}`}
        </button>
        {err && <p className="text-[12.5px] text-[#dc2626]">{err}{/부족/.test(err) && <> · <a href="/credits" className="underline">충전</a></>}</p>}
        <p className="text-[11.5px] text-[#8a90b2]">한국어로 써도 돼요. 4장에 1~2분(처음 한 번은 서버가 켜지느라 3~4분 더) 걸려요. 결과는 저장해야 드라이브에 남아요.</p>
      </div>

      {/* 결과 */}
      <div className="space-y-5 min-w-0">
        {job && (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-2xl bg-gradient-to-br from-[#eef1fb] to-[#e8eefb] animate-pulse" />)}</div>
        )}
        {!job && batches.length === 0 && (
          <div className={`${ui.card} py-20 flex flex-col items-center text-center`}>
            <p className="text-[44px]">🎨</p>
            <p className="mt-2 text-[15px] font-bold text-[#1f2340]">만든 이미지가 여기 나타나요</p>
            <p className="mt-1 text-[12.5px] text-[#8a90b2]">마음에 드는 것만 골라 드라이브에 저장하거나 바로 3D 모델로 만들 수 있어요</p>
          </div>
        )}
        {batches.map((b) => (
          <div key={b.token}>
            <p className="text-[12.5px] text-[#4b5277] mb-2 truncate">“{b.prompt}”</p>
            <div className="grid grid-cols-2 gap-3">
              {b.images.map((src, i) => (
                <div key={src} className={`group relative rounded-2xl overflow-hidden border border-[#e3e7f6] ${ui.checker}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full aspect-square object-contain cursor-zoom-in" onClick={() => setZoom(src)} />
                  <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1.5 bg-gradient-to-t from-black/55 to-transparent sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => save(b, i)} disabled={!!b.saved[i]} className="h-8 px-3 rounded-lg bg-white text-[#1f2340] text-[12px] font-bold disabled:bg-[#dcfce7] disabled:text-[#15803d]">{b.saved[i] ? '저장됨 ✓' : '💾 저장'}</button>
                    <button onClick={() => save(b, i, true)} className="h-8 px-3 rounded-lg bg-[#4f46e5] text-white text-[12px] font-bold">🧊 3D로</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className={`max-w-full max-h-full rounded-xl ${ui.checker}`} />
        </div>
      )}
    </div>
  )
}
