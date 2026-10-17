'use client'
// 전체 갤러리 — 공개된 모든 디자인을 둘러보고·검색해 참고하거나 3D 로 만든다
import { useEffect, useState } from 'react'
import { ui, rigBadge, type Source3D } from './shared'
import { GlbViewer } from './GlbViewer'

interface Asset { meta?: { rig?: string } | null; id: string; kind: string; name: string; title: string; url?: string; preview?: string | null; width: number | null; height: number | null; designer_name: string | null; tags?: string[]; uses?: number | null }
const KINDS: [string, string][] = [['', '전체'], ['character', '캐릭터'], ['background', '배경'], ['item', '아이템'], ['tile', '타일·맵'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트'], ['model3d', '3D 모델']]

export default function GallerySearch({ onMake3D }: { onMake3D: (s: Source3D) => void }) {
  const [q, setQ] = useState(''); const [kind, setKind] = useState('')
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const [items, setItems] = useState<Asset[] | null>(null)
  const [view, setView] = useState<Asset | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { fetch(`/api/library?q=${encodeURIComponent(q)}&kind=${kind}&limit=200`).then((r) => r.json()).then((j) => setItems((j.items ?? []).filter((a: Asset) => a.kind !== 'audio' && (kind === 'model3d' || a.kind !== 'model3d')))).catch(() => setItems([])) }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, kind])

  return (
    <div className="space-y-4">
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="갤러리에서 찾기 — 드래곤, 숲, 픽셀, 우주…" className={`${ui.input} h-12 pl-11 text-[14.5px] rounded-[4px]`} />
        <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9a8b72]" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">{KINDS.map(([v, l]) => <button key={v} onClick={() => setKind(v)} className={ui.chip(kind === v)}>{l}</button>)}</div>
      <div className="flex items-center gap-2">
        <p className="text-[14px] text-[#2b2419]"><b>{q.trim() ? `‘${q.trim()}’` : '전체 갤러리'}</b> <span className="text-[#9a8b72]">{items ? `${items.length.toLocaleString()}개` : ''}</span></p>
        <div className="ml-auto inline-flex rounded-[4px] border border-[#e6dac4] bg-white p-0.5">
          {([['new', '최신순'], ['popular', '인기순']] as const).map(([v, l]) => <button key={v} onClick={() => setSort(v)} className={`h-8 px-3 rounded-[4px] text-[12.5px] font-bold ${sort === v ? 'bg-[#2b2419] text-white' : 'text-[#5f523f]'}`}>{l}</button>)}
        </div>
      </div>
      {items === null ? <p className="py-20 text-center text-[13px] text-[#9a8b72]">불러오는 중…</p>
        : items.length === 0 ? <p className="py-20 text-center text-[13px] text-[#9a8b72]">찾는 디자인이 없어요</p>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {(sort === 'popular' ? [...items].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)) : items).map((a) => (
              <button key={a.id} onClick={() => setView(a)} className="group relative block w-full aspect-[3/4] rounded-[4px] overflow-hidden border border-[#ece2d0] bg-[linear-gradient(160deg,#fffaf2_0%,#f1e4cc_60%,#e2cfab_100%)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(120,84,40,0.55)] transition-all text-left">
                {a.kind === 'model3d' && <span className="absolute top-2 left-2 z-10 flex gap-1"><span className="text-[10px] font-extrabold bg-[#2b2419] text-white rounded-[2px] px-1.5 py-0.5">3D</span>{rigBadge(a.meta?.rig) && <span className="text-[10px] font-extrabold bg-[#a8783f] text-white rounded-[2px] px-1.5 py-0.5">{rigBadge(a.meta?.rig)}</span>}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.preview ?? a.url ?? ''} alt={a.title} loading="lazy" className="absolute inset-0 w-full h-full object-contain p-3 pb-12 group-hover:scale-[1.04] transition-transform duration-500" />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-2.5 py-2 bg-gradient-to-t from-[#2b2419]/80 via-[#2b2419]/45 to-transparent">
                  <span className="w-5 h-5 shrink-0 bg-gradient-to-br from-[#e8d3a8] to-[#a8783f] rounded-[2px]" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-white truncate">{a.title}</span><span className="block text-[10.5px] text-white/70 truncate">{a.designer_name ?? 'Vibrex'}</span></span>
                  <span className="shrink-0 text-[10.5px] font-bold text-white/80 tabular-nums">{(a.uses ?? 0).toLocaleString()}회</span>
                </span>
              </button>
            ))}
          </div>
        )}
      {view && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setView(null)}>
          <div className="w-full max-w-xl bg-white rounded-[4px] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`${ui.checker} flex items-center justify-center h-[50vh] max-h-[440px]`}>
              {view.kind === 'model3d' && view.url ? <div className="w-full h-full"><GlbViewer url={view.url} /></div> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.url ?? view.preview ?? ''} alt={view.title} className="max-w-full max-h-full object-contain" />
              )}
            </div>
            <div className="p-4">
              <p className="text-[15px] font-extrabold text-[#2b2419]">{view.title}</p>
              <p className="text-[12px] text-[#9a8b72]">{view.name}{view.width ? ` · ${view.width}×${view.height}` : ''}{view.designer_name ? ` · by ${view.designer_name}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {view.kind !== 'model3d' && <button onClick={() => { onMake3D({ kind: 'media', id: view.id, url: view.url ?? view.preview ?? '', title: view.title }); setView(null) }} className={ui.primary}>3D로 만들기</button>}
                {view.kind === 'model3d' && view.url && <a href={view.url} download className={ui.primary}>GLB 받기</a>}
                <button onClick={async () => { try { await navigator.clipboard.writeText(view.name); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* 무시 */ } }} className={ui.ghost}>{copied ? '복사됨 ✓' : '코드 키 복사'}</button>
                <button onClick={() => setView(null)} className={ui.ghost}>닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
