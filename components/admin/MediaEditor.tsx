'use client'
// 미디어 이미지 편집기 — 캔버스 기반: 자르기·크기 조절·회전·뒤집기·배경 제거(색상 키)·밝기/대비/채도/색조·픽셀화. PNG 로 덮어쓰거나 새 에셋으로 저장.
import { useCallback, useEffect, useRef, useState } from 'react'
import { btn, input, label as labelCls } from '@/components/admin/tokens'

interface Props { open: boolean; url: string; title: string; onClose: () => void; onSave: (blob: Blob, dims: { w: number; h: number }, asNew: boolean) => Promise<void> }
type Tool = 'crop' | 'resize' | 'bg' | 'adjust' | 'pixel'

export default function MediaEditor({ open, url, title, onClose, onSave }: Props) {
  const baseRef = useRef<HTMLCanvasElement | null>(null)      // 확정된 원본(파괴적 편집 적용)
  const viewRef = useRef<HTMLCanvasElement | null>(null)      // 화면 미리보기
  const undoRef = useRef<ImageData[]>([])
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<Tool>('crop')
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [rw, setRw] = useState(0); const [rh, setRh] = useState(0); const [lock, setLock] = useState(true)
  const [adj, setAdj] = useState({ b: 100, c: 100, s: 100, h: 0 })
  const [pix, setPix] = useState(4)
  const [bg, setBg] = useState<{ color: [number, number, number] | null; tol: number; feather: boolean }>({ color: null, tol: 40, feather: true })
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 로드
  useEffect(() => {
    if (!open) return
    undoRef.current = []
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      setErr(null); setCrop(null); setAdj({ b: 100, c: 100, s: 100, h: 0 }); setBg({ color: null, tol: 40, feather: true })
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0); baseRef.current = c
      setDims({ w: c.width, h: c.height }); setRw(c.width); setRh(c.height); setReady(true)
    }
    img.onerror = () => setErr('이미지를 불러오지 못했어요 (CORS 또는 형식 문제)')
    img.src = url + (url.includes('?') ? '&' : '?') + 'edit=' + Date.now()
  }, [open, url])

  // 미리보기 렌더 (비파괴 필터 미리보기 포함)
  const render = useCallback(() => {
    const base = baseRef.current, view = viewRef.current; if (!base || !view) return
    view.width = base.width; view.height = base.height
    const ctx = view.getContext('2d')!
    ctx.clearRect(0, 0, view.width, view.height)
    ctx.filter = tool === 'adjust' ? `brightness(${adj.b}%) contrast(${adj.c}%) saturate(${adj.s}%) hue-rotate(${adj.h}deg)` : 'none'
    ctx.drawImage(base, 0, 0); ctx.filter = 'none'
    if (tool === 'bg' && bg.color) applyChroma(ctx, view.width, view.height, bg.color, bg.tol, bg.feather)
    if (tool === 'pixel' && pix > 1) {
      const tmp = document.createElement('canvas'); tmp.width = Math.max(1, Math.round(view.width / pix)); tmp.height = Math.max(1, Math.round(view.height / pix))
      const t = tmp.getContext('2d')!; t.imageSmoothingEnabled = false; t.drawImage(view, 0, 0, tmp.width, tmp.height)
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, view.width, view.height); ctx.drawImage(tmp, 0, 0, view.width, view.height); ctx.imageSmoothingEnabled = true
    }
    if (tool === 'crop' && crop) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath(); ctx.rect(0, 0, view.width, view.height); ctx.rect(crop.x, crop.y, crop.w, crop.h); ctx.fill('evenodd')
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = Math.max(1, view.width / 300); ctx.setLineDash([6, 4]); ctx.strokeRect(crop.x, crop.y, crop.w, crop.h); ctx.restore()
    }
  }, [tool, adj, bg, pix, crop])
  useEffect(() => { if (ready) render() }, [ready, render])

  const pushUndo = () => { const b = baseRef.current!; const d = b.getContext('2d')!.getImageData(0, 0, b.width, b.height); undoRef.current = [...undoRef.current.slice(-9), d] }
  const undo = () => { const d = undoRef.current.pop(); const b = baseRef.current; if (!d || !b) return; b.width = d.width; b.height = d.height; b.getContext('2d')!.putImageData(d, 0, 0); setDims({ w: b.width, h: b.height }); setRw(b.width); setRh(b.height); setCrop(null); render() }
  const commitFromView = () => {
    // 현재 미리보기(필터/배경제거/픽셀화 적용본)를 원본으로 확정
    const view = viewRef.current!, base = baseRef.current!; pushUndo()
    base.width = view.width; base.height = view.height; base.getContext('2d')!.drawImage(view, 0, 0)
    setAdj({ b: 100, c: 100, s: 100, h: 0 }); setBg(v => ({ ...v, color: null })); setPix(4); render()
  }
  const transform = (kind: 'rotL' | 'rotR' | 'flipH' | 'flipV') => {
    const base = baseRef.current!; pushUndo()
    const tmp = document.createElement('canvas'); const rot = kind === 'rotL' || kind === 'rotR'
    tmp.width = rot ? base.height : base.width; tmp.height = rot ? base.width : base.height
    const t = tmp.getContext('2d')!; t.translate(tmp.width / 2, tmp.height / 2)
    if (kind === 'rotL') t.rotate(-Math.PI / 2); if (kind === 'rotR') t.rotate(Math.PI / 2)
    if (kind === 'flipH') t.scale(-1, 1); if (kind === 'flipV') t.scale(1, -1)
    t.drawImage(base, -base.width / 2, -base.height / 2)
    base.width = tmp.width; base.height = tmp.height; base.getContext('2d')!.drawImage(tmp, 0, 0)
    setDims({ w: base.width, h: base.height }); setRw(base.width); setRh(base.height); setCrop(null); render()
  }
  const applyCrop = () => {
    const base = baseRef.current!; if (!crop || crop.w < 2 || crop.h < 2) return; pushUndo()
    const d = base.getContext('2d')!.getImageData(crop.x, crop.y, crop.w, crop.h)
    base.width = crop.w; base.height = crop.h; base.getContext('2d')!.putImageData(d, 0, 0)
    setDims({ w: base.width, h: base.height }); setRw(base.width); setRh(base.height); setCrop(null); render()
  }
  const trimTransparent = () => {
    const base = baseRef.current!; const ctx = base.getContext('2d')!; const d = ctx.getImageData(0, 0, base.width, base.height).data
    let x0 = base.width, y0 = base.height, x1 = -1, y1 = -1
    for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) { if (d[(y * base.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
    if (x1 < 0) return
    setCrop({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1}); setTool('crop')
  }
  const applyResize = () => {
    const base = baseRef.current!; const w = Math.max(1, Math.round(rw)), h = Math.max(1, Math.round(rh)); if (w === base.width && h === base.height) return; pushUndo()
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const t = tmp.getContext('2d')!
    t.imageSmoothingEnabled = !(w < base.width / 2 && base.width <= 256)  // 작은 픽셀아트 축소는 계단 유지
    t.imageSmoothingQuality = 'high'; t.drawImage(base, 0, 0, w, h)
    base.width = w; base.height = h; base.getContext('2d')!.drawImage(tmp, 0, 0)
    setDims({ w, h }); setCrop(null); render()
  }
  // 캔버스 좌표 변환
  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => { const c = viewRef.current!; const r = c.getBoundingClientRect(); return { x: Math.round((e.clientX - r.left) * c.width / r.width), y: Math.round((e.clientY - r.top) * c.height / r.height) } }
  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = toCanvas(e)
    if (tool === 'bg') { const base = baseRef.current!; const d = base.getContext('2d')!.getImageData(Math.min(base.width - 1, Math.max(0, p.x)), Math.min(base.height - 1, Math.max(0, p.y)), 1, 1).data; setBg(v => ({ ...v, color: [d[0], d[1], d[2]] })); return }
    if (tool === 'crop') { dragRef.current = p; setCrop({ x: p.x, y: p.y, w: 0, h: 0 }) }
  }
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'crop' || !dragRef.current) return
    const p = toCanvas(e); const s = dragRef.current; const c = viewRef.current!
    const x = Math.max(0, Math.min(s.x, p.x)), y = Math.max(0, Math.min(s.y, p.y))
    setCrop({ x, y, w: Math.min(c.width - x, Math.abs(p.x - s.x)), h: Math.min(c.height - y, Math.abs(p.y - s.y)) })
  }
  const onUp = () => { dragRef.current = null }
  const save = async (asNew: boolean) => {
    const base = baseRef.current!; setBusy(true); setErr(null)
    try {
      // 확정되지 않은 미리보기 효과가 있으면 먼저 확정
      const hasLive = (tool === 'adjust' && (adj.b !== 100 || adj.c !== 100 || adj.s !== 100 || adj.h !== 0)) || (tool === 'bg' && bg.color) || (tool === 'pixel' && pix > 1)
      const src = hasLive ? viewRef.current! : base
      const out = document.createElement('canvas'); out.width = src.width; out.height = src.height
      const octx = out.getContext('2d')!
      if (hasLive) { octx.drawImage(src, 0, 0) } else octx.drawImage(base, 0, 0)
      const blob: Blob = await new Promise((res, rej) => out.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png'))
      await onSave(blob, { w: out.width, h: out.height }, asNew)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  if (!open) return null
  const TOOLS: [Tool, string][] = [['crop', '자르기'], ['resize', '크기'], ['bg', '배경 제거'], ['adjust', '색 보정'], ['pixel', '픽셀화']]
  return (
    <div className="fixed inset-0 z-[95] bg-[#0f1219]/70 backdrop-blur-[2px] flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-xl shadow-2xl border border-[#e3e6ec] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e3e6ec]">
          <div className="flex items-center gap-3"><h2 className="text-[14px] font-bold text-[#1f2430]">이미지 편집 — {title}</h2><span className="text-[11.5px] text-[#6b7280]">{dims.w}×{dims.h}px</span></div>
          <div className="flex items-center gap-1.5">
            <button onClick={undo} className={btn.ghost} disabled={!ready}>↶ 되돌리기</button>
            <button onClick={() => transform('rotL')} className={btn.ghost} disabled={!ready} title="왼쪽 회전">⟲</button>
            <button onClick={() => transform('rotR')} className={btn.ghost} disabled={!ready} title="오른쪽 회전">⟳</button>
            <button onClick={() => transform('flipH')} className={btn.ghost} disabled={!ready} title="좌우 뒤집기">⇋</button>
            <button onClick={() => transform('flipV')} className={btn.ghost} disabled={!ready} title="상하 뒤집기">⇅</button>
            <button onClick={onClose} className={btn.icon} aria-label="닫기">✕</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex">
          <aside className="w-60 shrink-0 border-r border-[#e3e6ec] p-3 flex flex-col gap-3 overflow-y-auto bg-[#f7f8fa]">
            <div className="flex flex-wrap gap-1">{TOOLS.map(([t, l]) => <button key={t} onClick={() => setTool(t)} className={`h-7 px-2.5 rounded-md text-[12px] font-semibold border ${tool === t ? 'bg-[#2563eb] text-white border-[#2563eb]' : 'bg-white text-[#1f2430] border-[#d9dde5]'}`}>{l}</button>)}</div>
            {tool === 'crop' && <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-[#6b7280]">이미지 위에서 드래그해 영역을 정하세요.</p>
              {crop && <p className="text-[11.5px] text-[#1f2430]">{crop.w}×{crop.h} @ {crop.x},{crop.y}</p>}
              <button onClick={applyCrop} className={btn.primary} disabled={!crop || crop.w < 2}>자르기 적용</button>
              <button onClick={trimTransparent} className={btn.ghost}>투명 여백 자동 감지</button>
            </div>}
            {tool === 'resize' && <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>너비</label><input type="number" value={rw} onChange={e => { const w = Number(e.target.value); setRw(w); if (lock && dims.w) setRh(Math.round(w * dims.h / dims.w)) }} className={input} /></div>
                <div><label className={labelCls}>높이</label><input type="number" value={rh} onChange={e => { const h = Number(e.target.value); setRh(h); if (lock && dims.h) setRw(Math.round(h * dims.w / dims.h)) }} className={input} /></div>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[#1f2430]"><input type="checkbox" checked={lock} onChange={e => setLock(e.target.checked)} /> 비율 유지</label>
              <div className="flex flex-wrap gap-1">{[32, 64, 128, 256, 512].map(n => <button key={n} onClick={() => { setRw(n); setRh(lock ? Math.round(n * dims.h / dims.w) : n) }} className="h-6 px-2 rounded border border-[#d9dde5] bg-white text-[11px]">{n}px</button>)}</div>
              <button onClick={applyResize} className={btn.primary}>크기 적용</button>
            </div>}
            {tool === 'bg' && <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-[#6b7280]">이미지에서 지울 배경색을 클릭하세요.</p>
              <div className="flex items-center gap-2"><span className="w-6 h-6 rounded border border-[#d9dde5]" style={{ background: bg.color ? `rgb(${bg.color.join(',')})` : 'transparent' }} /><span className="text-[11.5px]">{bg.color ? `rgb(${bg.color.join(', ')})` : '선택 안 됨'}</span></div>
              <label className={labelCls}>허용 오차 {bg.tol}</label><input type="range" min={0} max={160} value={bg.tol} onChange={e => setBg(v => ({ ...v, tol: Number(e.target.value) }))} />
              <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={bg.feather} onChange={e => setBg(v => ({ ...v, feather: e.target.checked }))} /> 가장자리 부드럽게</label>
              <div className="flex gap-1"><button onClick={() => setBg(v => ({ ...v, color: [255, 255, 255] }))} className="h-6 px-2 rounded border border-[#d9dde5] bg-white text-[11px]">흰색</button><button onClick={() => setBg(v => ({ ...v, color: [0, 255, 0] }))} className="h-6 px-2 rounded border border-[#d9dde5] bg-white text-[11px]">녹색</button><button onClick={() => setBg(v => ({ ...v, color: [255, 0, 255] }))} className="h-6 px-2 rounded border border-[#d9dde5] bg-white text-[11px]">마젠타</button></div>
              <button onClick={commitFromView} className={btn.primary} disabled={!bg.color}>배경 제거 적용</button>
            </div>}
            {tool === 'adjust' && <div className="flex flex-col gap-2">
              {([['b', '밝기', 0, 200], ['c', '대비', 0, 200], ['s', '채도', 0, 300], ['h', '색조 회전', -180, 180]] as [keyof typeof adj, string, number, number][]).map(([k, l, mn, mx]) => (
                <div key={k}><label className={labelCls}>{l} {adj[k]}{k === 'h' ? '°' : '%'}</label><input type="range" min={mn} max={mx} value={adj[k]} onChange={e => setAdj(v => ({ ...v, [k]: Number(e.target.value) }))} className="w-full" /></div>
              ))}
              <button onClick={commitFromView} className={btn.primary}>보정 적용</button>
              <button onClick={() => setAdj({ b: 100, c: 100, s: 100, h: 0 })} className={btn.ghost}>초기화</button>
            </div>}
            {tool === 'pixel' && <div className="flex flex-col gap-2">
              <label className={labelCls}>픽셀 크기 {pix}</label><input type="range" min={1} max={24} value={pix} onChange={e => setPix(Number(e.target.value))} />
              <p className="text-[11.5px] text-[#6b7280]">레트로 픽셀아트 느낌으로 바꿔요.</p>
              <button onClick={commitFromView} className={btn.primary} disabled={pix <= 1}>픽셀화 적용</button>
            </div>}
          </aside>
          <div className="flex-1 min-w-0 flex items-center justify-center p-4 overflow-auto bg-[repeating-conic-gradient(#e6e9ef_0_25%,#f7f8fa_0_50%)] bg-[length:20px_20px]">
            {err && <p className="text-[13px] text-red-600">{err}</p>}
            {!err && <canvas ref={viewRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} className={`max-w-full max-h-full shadow-lg bg-transparent ${tool === 'crop' ? 'cursor-crosshair' : tool === 'bg' ? 'cursor-cell' : ''}`} style={{ imageRendering: dims.w <= 160 ? 'pixelated' : 'auto' }} />}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e3e6ec] bg-white">
          <p className="text-[11.5px] text-[#6b7280]">PNG(투명 지원)로 저장돼요. 덮어쓰면 이 에셋을 쓰는 새 게임부터 반영됩니다.</p>
          <div className="flex gap-2"><button onClick={() => save(true)} className={btn.ghost} disabled={!ready || busy}>새 에셋으로 저장</button><button onClick={() => save(false)} className={btn.primary} disabled={!ready || busy}>{busy ? '저장 중…' : '덮어쓰기'}</button></div>
        </div>
      </div>
    </div>
  )
}

function applyChroma(ctx: CanvasRenderingContext2D, w: number, h: number, color: [number, number, number], tol: number, feather: boolean) {
  const im = ctx.getImageData(0, 0, w, h); const d = im.data
  const [cr, cg, cb] = color; const t2 = tol * tol
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - cr, dg = d[i + 1] - cg, db = d[i + 2] - cb; const dist = dr * dr + dg * dg + db * db
    if (dist <= t2) d[i + 3] = 0
    else if (feather && dist <= t2 * 2.2) d[i + 3] = Math.min(d[i + 3], Math.round(255 * (dist - t2) / (t2 * 1.2)))
  }
  ctx.putImageData(im, 0, 0)
}
