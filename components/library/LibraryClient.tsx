'use client'
// 갤러리 — 승인된 디자인(미디어 라이브러리) 검색·둘러보기. 이미지 사이트처럼 검색창 + 분류 + 촘촘한 이미지 벽.
// 디자이너 접수·작품 등록은 스튜디오 › 디자인 AI(/studio/design) 에서. 3D 모델은 여기 노출하지 않는다.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const GlbViewer = dynamic(() => import('@/components/designer/GlbViewer').then((m) => m.GlbViewer), { ssr: false })
import { useRouter, useSearchParams } from 'next/navigation'

interface Asset { meta?: { rig?: string } | null; id: string; kind: string; name: string; title: string; description: string | null; tags: string[]; url?: string; preview: string | null; width: number | null; height: number | null; uses: number | null; created_at: string; designer_name: string | null }
const KINDS: [string, string][] = [['', '전체'], ['character', '캐릭터'], ['background', '배경'], ['item', '아이템'], ['tile', '타일·맵'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트'], ['model3d', '3D 모델'], ['audio', '효과음·음악']]
const SUGGEST = ['드래곤', '우주', '숲', '픽셀', '귀여운', '바다', '던전', '네온']

export default function LibraryClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params?.get('q') ?? '')
  const [kind, setKind] = useState(params?.get('kind') ?? '')
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const [items, setItems] = useState<Asset[] | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [preview, setPreview] = useState<Asset | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/library?q=${encodeURIComponent(q.trim())}&kind=${kind}&limit=200`).then((r) => r.json()).then((j) => { setItems(j.items ?? []); setLoggedIn(!!j.loggedIn) }).catch(() => setItems([]))
      const sp = new URLSearchParams(); if (q.trim()) sp.set('q', q.trim()); if (kind) sp.set('kind', kind)
      router.replace(`/gallery${sp.toString() ? '?' + sp : ''}`, { scroll: false })
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, kind, router])

  const shown = useMemo(() => {
    const list = (items ?? []).filter((a) => (kind === 'model3d' || a.kind !== 'model3d') && (kind === 'audio' || a.kind !== 'audio'))  // 소리·3D 는 각자 탭에서만
    return sort === 'popular' ? [...list].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)) : list
  }, [items, sort, kind])
  // 결과에서 많이 쓰인 태그 → 연관 검색어
  const related = useMemo(() => {
    const c = new Map<string, number>()
    for (const a of items ?? []) for (const t of a.tags ?? []) if (t && t !== q.trim()) c.set(t, (c.get(t) ?? 0) + 1)
    const top = [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 10)
    return top.length ? top : SUGGEST
  }, [items, q])

  return (
    <div className="min-h-screen bg-[#fcfaf5]">
      {/* 검색 */}
      <section className="bg-white border-b border-[#ebe4d6]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-5 md:pt-12 md:pb-6">
          <h1 className="text-[24px] md:text-[32px] font-black tracking-tight text-[#241f17]">게임 디자인 <span className="text-[#2563eb]">갤러리</span></h1>
          <p className="mt-1 text-[13px] md:text-[14px] text-[#6b6152]">디자이너들이 올린 캐릭터·배경·아이템·효과음 — 골라서 바로 게임에 넣어 보세요</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-5 flex items-stretch rounded-2xl border-2 border-[#2563eb] bg-white overflow-hidden shadow-[0_8px_24px_-16px_rgba(37,99,235,0.6)] max-w-3xl">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="분류" className="hidden sm:block shrink-0 px-4 text-[13.5px] font-bold text-[#241f17] bg-[#f5f8ff] border-r border-[#d6e2fb] outline-none">
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾고 싶은 디자인을 검색해 보세요 — 드래곤, 우주, 픽셀…" className="flex-1 min-w-0 h-14 px-4 text-[15px] text-[#241f17] outline-none placeholder:text-[#b3a993]" />
            {q && <button type="button" onClick={() => setQ('')} className="px-3 text-[#b3a993] hover:text-[#241f17]" aria-label="지우기">✕</button>}
            <span className="shrink-0 w-14 flex items-center justify-center bg-[#2563eb] text-white">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.6}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </span>
          </form>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="shrink-0 text-[12px] font-bold text-[#9d9280]">{q ? '연관' : '추천'}</span>
            {related.map((t) => <button key={t} onClick={() => setQ(t)} className="shrink-0 h-7 px-3 rounded-full bg-[#f1ede4] hover:bg-[#e6dfd0] text-[12.5px] text-[#4a4337]">#{t}</button>)}
          </div>
        </div>
        {/* 분류 탭 */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {KINDS.map(([v, l]) => (
            <button key={v} onClick={() => setKind(v)} className={`shrink-0 h-11 px-3.5 text-[13.5px] font-bold border-b-[3px] transition-colors ${kind === v ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#6b6152] hover:text-[#241f17]'}`}>{l}</button>
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-4">
        {/* 디자이너 모집 (작게) */}
        <Link href="/studio/design" className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#fff1f6] via-[#fff7ec] to-[#f0f5ff] border border-[#f3dfe6] px-4 py-3 hover:shadow-md transition-shadow">
          <span className="text-[22px]">🎨</span>
          <p className="flex-1 min-w-0 text-[13px] text-[#4a4337]" style={{ wordBreak: 'keep-all' }}><b className="text-[#241f17]">게임 디자이너를 찾습니다</b><span className="hidden sm:inline"> — 내 디자인이 게임에 쓰일 때마다 크레딧이 <b className="text-[#be185d]">100%</b> 디자이너에게 쌓여요</span></p>
          <span className="shrink-0 text-[12.5px] font-bold text-[#2563eb] group-hover:translate-x-0.5 transition-transform">디자인 AI 시작 →</span>
        </Link>

        {/* 결과 줄 */}
        <div className="flex items-center gap-2">
          <p className="text-[14px] text-[#241f17]"><b>{q.trim() ? `‘${q.trim()}’` : KINDS.find((k) => k[0] === kind)?.[1]}</b> <span className="text-[#9d9280]">{items === null ? '' : `${shown.length.toLocaleString()}개`}</span></p>
          <div className="ml-auto inline-flex rounded-lg border border-[#e6dfd0] bg-white p-0.5">
            {([['new', '최신순'], ['popular', '인기순']] as const).map(([v, l]) => <button key={v} onClick={() => setSort(v)} className={`h-8 px-3 rounded-md text-[12.5px] font-bold ${sort === v ? 'bg-[#241f17] text-white' : 'text-[#6b6152]'}`}>{l}</button>)}
          </div>
        </div>

        {/* 이미지 벽 */}
        {items === null ? (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 [&>*]:mb-3">{Array.from({ length: 15 }, (_, i) => <div key={i} className="rounded-xl bg-[#f1ede4] animate-pulse" style={{ height: 140 + ((i * 53) % 120) }} />)}</div>
        ) : shown.length === 0 ? (
          <div className="py-24 text-center"><p className="text-[40px]">🔍</p><p className="mt-2 text-[15px] font-bold text-[#241f17]">{q ? '검색 결과가 없어요' : '아직 등록된 디자인이 없어요'}</p><p className="mt-1 text-[13px] text-[#9d9280]">다른 검색어나 분류를 골라 보세요</p></div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 [&>*]:mb-3">
            {shown.map((a) => (
              <button key={a.id} onClick={() => setPreview(a)} className="group relative block w-full break-inside-avoid rounded-xl overflow-hidden bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:14px_14px] border border-[#ebe4d6] hover:shadow-[0_14px_30px_-14px_rgba(36,31,23,0.45)] transition-shadow text-left">
                {a.kind === 'model3d' && <span className="absolute top-2 left-2 z-10 flex gap-1"><span className="text-[10px] font-extrabold bg-[#241f17] text-white rounded px-1.5 py-0.5">3D</span>{a.meta?.rig === 'face' ? <span className="text-[10px] font-extrabold bg-[#16a34a] text-white rounded px-1.5 py-0.5">🦴 움직임 · 😀 표정</span> : a.meta?.rig === 'anim' ? <span className="text-[10px] font-extrabold bg-[#16a34a] text-white rounded px-1.5 py-0.5">🦴 움직임</span> : a.meta?.rig === 'bones' ? <span className="text-[10px] font-extrabold bg-[#16a34a] text-white rounded px-1.5 py-0.5">🦴 뼈대</span> : null}</span>}
                {a.kind === 'audio' ? (
                  <div className="aspect-[4/3] flex flex-col items-center justify-center bg-gradient-to-br from-[#eef4ff] to-[#fdf2f8]"><span className="text-[36px]">🎵</span><span className="mt-1 text-[12px] font-bold text-[#4a4337] px-2 truncate max-w-full">{a.title}</span></div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.preview ?? ''} alt={a.title} loading="lazy" className="w-full h-auto object-contain group-hover:scale-[1.03] transition-transform duration-500" style={a.width && a.height ? { aspectRatio: `${a.width}/${a.height}` } : { aspectRatio: '1/1' }} />
                )}
                <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[12.5px] font-bold text-white truncate">{a.title}</p>
                  {a.designer_name && <p className="text-[10.5px] text-white/75 truncate">by {a.designer_name}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 미리보기 */}
      {preview && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl md:flex" onClick={(e) => e.stopPropagation()}>
            <div className="md:flex-1 bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:18px_18px] flex items-center justify-center min-h-[260px] max-h-[60vh] md:max-h-[560px]">
              {preview.kind === 'model3d' ? (preview.url ? <div className="w-full h-[60vh] md:h-[520px]"><GlbViewer url={preview.url} /></div> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.preview ?? ''} alt={preview.title} className="max-h-[60vh] md:max-h-[560px] w-auto object-contain" />
              )) : preview.kind === 'audio' ? (preview.url ? <audio src={preview.url} controls className="my-10 w-[90%]" /> : <p className="my-10 text-[13px] text-[#6b6152]">🔒 로그인하면 들어 볼 수 있어요</p>) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url ?? preview.preview ?? ''} alt={preview.title} className="max-h-[60vh] md:max-h-[560px] w-auto object-contain" />
              )}
            </div>
            <div className="md:w-[300px] p-5 flex flex-col">
              <p className="text-[18px] font-extrabold text-[#241f17]">{preview.title}</p>
              <p className="text-[12px] text-[#9d9280] mt-0.5">{KINDS.find((k) => k[0] === preview.kind)?.[1] ?? preview.kind}{preview.width ? ` · ${preview.width}×${preview.height}` : ''}{preview.designer_name ? ` · by ${preview.designer_name}` : ''}</p>
              {preview.description && <p className="text-[13px] text-[#4a4337] mt-3 leading-relaxed">{preview.description}</p>}
              {(preview.tags ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-1">{preview.tags.slice(0, 8).map((t) => <button key={t} onClick={() => { setQ(t); setPreview(null) }} className="h-6 px-2 rounded-full bg-[#f1ede4] text-[11.5px] text-[#4a4337]">#{t}</button>)}</div>}
              <div className="mt-4 rounded-xl bg-[#f5f8ff] border border-[#d6e2fb] px-3 py-2.5 text-[12px] text-[#3b4a6b]" style={{ wordBreak: 'keep-all' }}>
                코드 키 <code className="bg-white px-1.5 py-0.5 rounded font-bold text-[#1e3a8a]">{preview.name}</code><br />스튜디오 프롬프트에 이 이름을 적거나 미디어 선택기에서 고르면 게임에 들어가요.
              </div>
              {!loggedIn && <p className="mt-3 text-[12px] text-[#9d9280]">🔒 워터마크 미리보기예요. <a href="/login?redirect=/gallery" className="text-[#2563eb] font-bold underline">로그인</a>하면 원본으로 보고{preview.kind === 'model3d' ? ' 3D 로 돌려 볼 수 있어요.' : ' 받을 수 있어요.'}</p>}
              {preview.url && <a href={preview.url} download target="_blank" rel="noreferrer" className="mt-3 text-[12.5px] font-bold text-[#2563eb]">⬇ 원본 받기</a>}
              <div className="mt-auto pt-4 flex gap-2">
                <Link href="/studio" className="flex-1 h-11 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13.5px] font-bold inline-flex items-center justify-center">스튜디오에서 쓰기</Link>
                <button onClick={async () => { try { await navigator.clipboard.writeText(preview.name); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* 무시 */ } }} className="h-11 px-3.5 rounded-xl border border-[#ddd3bf] text-[13px] font-semibold text-[#4a4337]">{copied ? '복사됨 ✓' : '키 복사'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
