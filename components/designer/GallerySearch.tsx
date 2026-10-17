'use client'
// 전체 갤러리 — 공개된 모든 디자인을 둘러보고·검색해 참고하거나 3D 로 만든다
import { useEffect, useState } from 'react'
import { ui, type Source3D } from './shared'
import { GlbViewer } from './GlbViewer'

interface Asset { id: string; kind: string; name: string; title: string; url?: string; preview?: string | null; width: number | null; height: number | null; designer_name: string | null; tags?: string[]; uses?: number | null }
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="갤러리에서 찾기 — 드래곤, 숲, 픽셀, 우주…" className={`${ui.input} h-12 pl-11 text-[14.5px] rounded-2xl`} />
        <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9d9280]" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">{KINDS.map(([v, l]) => <button key={v} onClick={() => setKind(v)} className={ui.chip(kind === v)}>{l}</button>)}</div>
      <div className="flex items-center gap-2">
        <p className="text-[14px] text-[#241f17]"><b>{q.trim() ? `‘${q.trim()}’` : '전체 갤러리'}</b> <span className="text-[#9d9280]">{items ? `${items.length.toLocaleString()}개` : ''}</span></p>
        <div className="ml-auto inline-flex rounded-lg border border-[#e6dfd0] bg-white p-0.5">
          {([['new', '최신순'], ['popular', '인기순']] as const).map(([v, l]) => <button key={v} onClick={() => setSort(v)} className={`h-8 px-3 rounded-md text-[12.5px] font-bold ${sort === v ? 'bg-[#241f17] text-white' : 'text-[#6b6152]'}`}>{l}</button>)}
        </div>
      </div>
      {items === null ? <p className="py-20 text-center text-[13px] text-[#9d9280]">불러오는 중…</p>
        : items.length === 0 ? <p className="py-20 text-center text-[13px] text-[#9d9280]">찾는 디자인이 없어요</p>
        : (
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 [&>*]:mb-3">
            {(sort === 'popular' ? [...items].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)) : items).map((a) => (
              <button key={a.id} onClick={() => setView(a)} className={`group block w-full break-inside-avoid rounded-xl overflow-hidden border border-[#ebe4d6] hover:border-[#cfc4ab] hover:shadow-lg transition-all ${ui.checker}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.preview ?? a.url ?? ''} alt={a.title} loading="lazy" className="w-full h-auto object-contain group-hover:scale-[1.03] transition-transform duration-500" style={a.width && a.height ? { aspectRatio: `${a.width}/${a.height}` } : undefined} />
              </button>
            ))}
          </div>
        )}
      {view && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setView(null)}>
          <div className="w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`${ui.checker} flex items-center justify-center h-[50vh] max-h-[440px]`}>
              {view.kind === 'model3d' && view.url ? <div className="w-full h-full"><GlbViewer url={view.url} /></div> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.url ?? view.preview ?? ''} alt={view.title} className="max-w-full max-h-full object-contain" />
              )}
            </div>
            <div className="p-4">
              <p className="text-[15px] font-extrabold text-[#241f17]">{view.title}</p>
              <p className="text-[12px] text-[#9d9280]">{view.name}{view.width ? ` · ${view.width}×${view.height}` : ''}{view.designer_name ? ` · by ${view.designer_name}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {view.kind !== 'model3d' && <button onClick={() => { onMake3D({ kind: 'media', id: view.id, url: view.url ?? view.preview ?? '', title: view.title }); setView(null) }} className={ui.primary}>🧊 3D로 만들기</button>}
                {view.kind === 'model3d' && view.url && <a href={view.url} download className={ui.primary}>⬇ GLB 받기</a>}
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
