'use client'
// 스튜디오 미디어 선택기 — 관리자가 모아둔 라이브러리에서 캐릭터·배경·아이템·오디오를 골라 생성 요청에 붙인다.
import { useEffect, useRef, useState } from 'react'

export interface PickedAsset { id: string; kind: string; name: string; title: string; url: string }
interface Item extends PickedAsset { description: string | null; genres: string[]; tags: string[]; width: number | null; height: number | null; uses: number; bytes: number; meta?: { role?: string } }
const ROLE: Record<string, string> = { bgm: '배경음', jump: '점프', hit: '타격', coin: '획득', shoot: '발사', explosion: '폭발', powerup: '파워업', gameover: '게임오버', clear: '클리어', click: 'UI', ambient: '환경음', other: '기타' }

const KINDS: [string, string][] = [['', '전체'], ['character', '캐릭터'], ['background', '배경'], ['item', '아이템'], ['tile', '타일'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트'], ['audio', '오디오']]

export default function MediaPicker({ open, onClose, picked, onChange }: { open: boolean; onClose: () => void; picked: PickedAsset[]; onChange: (next: PickedAsset[]) => void }) {
  const [q, setQ] = useState(''); const [kind, setKind] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // 오디오 미리듣기 — 한 번에 하나만, 닫으면 정지
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const preview = (e: React.MouseEvent, it: Item) => {
    e.stopPropagation()
    const a = audioRef.current ?? (audioRef.current = new Audio())
    if (playingId === it.id) { a.pause(); setPlayingId(null); return }
    a.pause(); a.src = it.url; a.currentTime = 0; a.volume = 0.8
    a.onended = () => setPlayingId(null)
    a.play().then(() => setPlayingId(it.id)).catch(() => setPlayingId(null))
  }
  useEffect(() => () => { audioRef.current?.pause() }, [])
  // 닫히면(어떤 경로든) 미리듣기 정지 — 컴포넌트는 남아 있어 unmount 정리가 안 돌기 때문
  useEffect(() => { if (!open) { audioRef.current?.pause(); const t = setTimeout(() => setPlayingId(null), 0); return () => clearTimeout(t) } }, [open])
  const close = () => { audioRef.current?.pause(); setPlayingId(null); onClose() }
  useEffect(() => {
    if (!open) return
    if (!q && !kind) return // 검색·카테고리 선택 전에는 안내만 보여준다(렌더에서 분기)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/media?q=${encodeURIComponent(q)}&kind=${kind}&limit=80`)
        const j = await r.json(); setItems(j.items ?? []); setErr(j.error ?? null)
      } catch { setErr('불러오지 못했어요') }
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [open, q, kind])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { audioRef.current?.pause(); onClose() } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const has = (id: string) => picked.some(p => p.id === id)
  const toggle = (it: Item) => {
    if (has(it.id)) onChange(picked.filter(p => p.id !== it.id))
    else if (picked.length < 10) onChange([...picked, { id: it.id, kind: it.kind, name: it.name, title: it.title, url: it.url }])
  }
  return (
    <div className="fixed inset-0 z-[90] bg-[#241f17]/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="w-full max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#ebe4d6] max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ebe4d6] shrink-0">
          <h2 className="text-[14px] font-bold text-[#241f17] shrink-0">미디어 라이브러리</h2>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="검색 — 기사, 우주, 숲, 픽셀…" className="flex-1 h-8 rounded-lg border border-[#ddd3bf] px-3 text-[13px] outline-none focus:border-[#2563eb]" />
          <button onClick={close} className="w-8 h-8 rounded-md text-[#6b6152] hover:bg-[#f1ede4]" aria-label="닫기">✕</button>
        </div>
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto overflow-y-hidden border-b border-[#f1ede4] shrink-0">
          {KINDS.map(([v, l]) => <button key={v} onClick={() => setKind(v)} className={`shrink-0 h-7 px-3 rounded-full text-[12px] border transition-colors ${kind === v ? 'bg-[#241f17] text-white border-[#241f17]' : 'bg-white text-[#6b6152] border-[#ddd3bf] hover:border-[#241f17]'}`}>{l}</button>)}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {err && <p className="text-[12.5px] text-red-600 mb-2">{err}</p>}
          {!q && !kind ? <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-center"><span className="text-[28px]">🔍</span><p className="text-[15px] font-bold text-[#241f17]">검색하세요</p><p className="text-[12.5px] text-[#9d9280]">위 검색창에 이름·태그를 입력하거나 카테고리를 선택하면 에셋이 나와요.</p></div>
            : items === null ? <p className="text-[13px] text-[#9d9280]">불러오는 중…</p>
            : items.length === 0 ? <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-center"><span className="text-[28px]">🗂️</span><p className="text-[15px] font-bold text-[#241f17]">{q ? '검색에 없습니다.' : '이 카테고리에 등록된 에셋이 없어요.'}</p>{q && <p className="text-[12.5px] text-[#9d9280]">다른 단어로 검색하거나 카테고리를 골라 보세요.</p>}</div>
            : <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {items.map(it => (
                <button key={it.id} onClick={() => toggle(it)} className={`group relative rounded-xl border-2 overflow-hidden text-left bg-[#f8f6f1] transition-all ${has(it.id) ? 'border-[#2563eb] shadow-[0_0_0_3px_rgba(37,99,235,0.15)]' : 'border-transparent hover:border-[#ddd3bf]'}`}>
                  <div className="aspect-square flex items-center justify-center bg-[repeating-conic-gradient(#ece8df_0_25%,#f8f6f1_0_50%)] bg-[length:16px_16px]">
                    {it.kind === 'audio' ? (
                      /* 미리듣기 버튼 — 선택(toggle)과 분리. 재생 중이면 ■ + 이퀄라이저 */
                      <span role="button" tabIndex={0} onClick={(e) => preview(e, it)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); preview(e as unknown as React.MouseEvent, it) } }} aria-label={playingId === it.id ? '미리듣기 정지' : '미리듣기'} title={playingId === it.id ? '정지' : '미리듣기'}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 ${playingId === it.id ? 'bg-[#241f17] text-white' : 'bg-white text-[#2563eb]'}`}>
                        {playingId === it.id ? (
                          <span className="flex items-end gap-[3px] h-5" aria-hidden>{[0, 1, 2, 3].map(i => <i key={i} className="block w-[3px] bg-[#22d3ee] rounded-sm animate-[eq_.8s_ease-in-out_infinite]" style={{ height: '100%', animationDelay: `${i * 0.12}s` }} />)}</span>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 translate-x-[1px]" fill="currentColor"><path d="M8 5.6v12.8c0 1.2 1.3 1.9 2.3 1.3l10.1-6.4a1.5 1.5 0 0 0 0-2.6L10.3 4.3C9.3 3.7 8 4.4 8 5.6Z" /></svg>
                        )}
                      </span>
                    ) : /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.url} alt={it.title} loading="lazy" className="max-w-full max-h-full object-contain" style={{ imageRendering: (it.width ?? 999) <= 128 ? 'pixelated' : 'auto' }} />}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-[12px] font-semibold text-[#241f17] truncate">{it.title}</p>
                    <p className="text-[10.5px] text-[#9d9280] truncate">{KINDS.find(k => k[0] === it.kind)?.[1] ?? it.kind}{it.kind === 'audio' && it.meta?.role ? ` · ${ROLE[it.meta.role] ?? it.meta.role}` : it.width ? ` · ${it.width}×${it.height}` : ''}</p>
                  </div>
                  {has(it.id) && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2563eb] text-white text-[11px] flex items-center justify-center">✓</span>}
                </button>
              ))}
            </div>}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#ebe4d6]">
          <p className="text-[12px] text-[#6b6152]">{picked.length}/10 선택 — 고른 에셋은 게임에 바로 들어가고, AI 가 캐릭터·배경으로 써요.</p>
          <button onClick={close} className="h-8 px-4 rounded-lg bg-[#2563eb] text-white text-[12.5px] font-semibold hover:bg-[#1d4ed8]">완료</button>
        </div>
      </div>
    </div>
  )
}
