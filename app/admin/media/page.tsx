'use client'
// 미디어 라이브러리 — 장르별 캐릭터·배경·타일·아이템·UI·이펙트·스프라이트·오디오·3D 모델을 모아두고 게임 생성에 바로 쓴다.
// 조회·검색·필터, 드래그 업로드(다중), 메타 편집, 이미지 편집(자르기/크기/배경제거/보정), 복제, 일괄 태그·삭제.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, Card, Badge, Segmented, Skeleton, EmptyState, ConfirmModal, Toast, Modal, Toggle, btn, input, label as labelCls } from '@/components/admin/ui'
import MediaEditor from '@/components/admin/MediaEditor'
import { AUDIO_ROLES, audioRoleLabel } from '@/lib/media/assets'

type Kind = 'character' | 'background' | 'tile' | 'item' | 'ui' | 'effect' | 'sprite' | 'audio' | 'model3d' | 'font' | 'other'
interface Asset { id: string; kind: Kind; name: string; title: string; description: string | null; credit_cost?: number; genres: string[]; tags: string[]; url: string; mime: string | null; bytes: number; width: number | null; height: number | null; meta: { frames?: { cols: number; rows: number; fps?: number }; role?: string } & Record<string, unknown>; auto_use: boolean; status: 'active' | 'archived'; uses: number; created_at: string }
interface Genre { slug: string; name: string; group?: string }
interface Data { items: Asset[]; total: number; genres: Genre[]; stats: { byKind: Record<string, number>; totalBytes: number; archived: number } }

const KINDS: [Kind | '', string, string][] = [['', '전체', '▦'], ['character', '캐릭터', '🧑‍🚀'], ['background', '배경', '🏞️'], ['tile', '타일·맵', '🧱'], ['item', '아이템', '🗝️'], ['ui', 'UI', '🔘'], ['effect', '이펙트', '✨'], ['sprite', '스프라이트', '🎞️'], ['audio', '오디오', '🎵'], ['model3d', '3D 모델', '🧊'], ['font', '폰트', '🔤'], ['other', '기타', '📦']]
const KIND_COLOR: Record<string, string> = { character: '#2563eb', background: '#0891b2', tile: '#7c3aed', item: '#d97706', ui: '#64748b', effect: '#ec4899', sprite: '#16a34a', audio: '#9333ea', model3d: '#0f766e', font: '#475569', other: '#6b7280' }
const kindLabel = (k: string) => KINDS.find(x => x[0] === k)?.[1] ?? k
const fmtBytes = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : n >= 1e3 ? `${Math.round(n / 1e3)}KB` : `${n}B`
const isImg = (a: Asset) => !!a.mime?.startsWith('image/')
const readDims = (f: File) => new Promise<{ w: number; h: number } | null>(res => { if (!f.type.startsWith('image/')) return res(null); const u = URL.createObjectURL(f); const i = new Image(); i.onload = () => { res({ w: i.naturalWidth, h: i.naturalHeight }); URL.revokeObjectURL(u) }; i.onerror = () => res(null); i.src = u })

function Thumb({ a, className = '' }: { a: Asset; className?: string }) {
  const icon = KINDS.find(k => k[0] === a.kind)?.[2] ?? '📦'
  return (
    <div className={`flex items-center justify-center bg-[repeating-conic-gradient(#e6e9ef_0_25%,#f7f8fa_0_50%)] bg-[length:14px_14px] ${className}`}>
      {isImg(a) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.url} alt={a.title} loading="lazy" className="max-w-full max-h-full object-contain" style={{ imageRendering: (a.width ?? 999) <= 128 ? 'pixelated' : 'auto' }} />
        : a.kind === 'audio' ? <audio src={a.url} controls className="w-[90%] h-8" preload="none" /> : <span className="text-4xl">{icon}</span>}
    </div>
  )
}

export default function AdminMediaPage() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<{ msg: string; missing?: boolean } | null>(null)
  const [q, setQ] = useState(''); const [kind, setKind] = useState<Kind | ''>(''); const [genre, setGenre] = useState(''); const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'grid' | 'list' | 'genre'>('grid')
  // 썸네일 크기 — 데이터가 많아지므로 기본은 작게 (localStorage 기억)
  const [size, setSize] = useState<'xs' | 'sm' | 'md'>('xs')
  useEffect(() => { try { const v = localStorage.getItem('vx_media_size'); if (v === 'xs' || v === 'sm' || v === 'md') { const t = setTimeout(() => setSize(v), 0); return () => clearTimeout(t) } } catch { /* */ } }, [])
  const pickSize = (v: 'xs' | 'sm' | 'md') => { setSize(v); try { localStorage.setItem('vx_media_size', v) } catch { /* */ } }
  const GRID = { xs: 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-1.5', sm: 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2', md: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3' }[size]
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<Asset | null>(null)
  const [editor, setEditor] = useState<Asset | null>(null)
  const [del, setDel] = useState<string[] | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const say = (msg: string, k: 'ok' | 'err' = 'ok') => { setToast({ msg, kind: k }); setTimeout(() => setToast(null), 2600) }
  // 업로드
  const fileRef = useRef<HTMLInputElement>(null)
  const [drop, setDrop] = useState(false)
  const [up, setUp] = useState<{ files: File[]; kind: Kind | ''; genres: string[]; tags: string; description: string; auto: boolean; title: string; name: string; role: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [bulk, setBulk] = useState<{ genres: string[]; tags: string } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/media?q=${encodeURIComponent(q)}&kind=${kind}&genre=${genre}&status=${status}&page=${page}&limit=60`)
    const j = await r.json(); if (!r.ok) setErr({ msg: j.error, missing: j.missing }); else { setErr(null); setData(j) }
  }, [q, kind, genre, status, page])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => { const t = setTimeout(() => setPage(1), 0); return () => clearTimeout(t) }, [q, kind, genre, status])

  const genres = data?.genres ?? []
  const genreName = (slug: string) => genres.find(g => g.slug === slug)?.name ?? slug
  const groups = useMemo(() => { const m = new Map<string, Genre[]>(); for (const g of genres) { const k = g.group ?? '기타'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(g) } return m }, [genres])

  const openUpload = async (files: FileList | File[] | null) => { const arr = Array.from(files ?? []).filter(f => f.size > 0); if (!arr.length) return; setUp({ files: arr, kind: kind || (arr.every(f => f.type.startsWith('audio/')) ? 'audio' : ''), genres: genre ? [genre] : [], tags: '', description: '', auto: true, title: arr.length === 1 ? arr[0].name.replace(/\.[a-z0-9]+$/i, '') : '', name: '', role: '' }) }
  const doUpload = async () => {
    if (!up) return; setUploading(true)
    const fd = new FormData(); for (const f of up.files) fd.append('files', f)
    const dims: Record<string, { w: number; h: number }> = {}; for (const f of up.files) { const d = await readDims(f); if (d) dims[f.name] = d }
    fd.set('dims', JSON.stringify(dims)); fd.set('kind', up.kind); fd.set('genres', up.genres.join(',')); fd.set('tags', up.tags); fd.set('description', up.description); fd.set('auto_use', up.auto ? '1' : '0'); if (up.title) fd.set('title', up.title); if (up.name) fd.set('name', up.name); if (up.role) fd.set('role', up.role)
    const r = await fetch('/api/admin/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({})); setUploading(false)
    if (!r.ok) { say(j.error ?? '업로드 실패', 'err'); return }
    setUp(null); say(`${(j.items ?? []).length}개 추가${j.savedBytes > 1024 ? ` · WebP 변환으로 ${fmtBytes(j.savedBytes)} 절약` : ''}${j.errors?.length ? ` · 실패 ${j.errors.length}` : ''}`, j.errors?.length ? 'err' : 'ok'); if (j.errors?.length) console.warn(j.errors); load()
  }
  const patch = async (body: Record<string, unknown>, okMsg = '저장했어요.') => { const r = await fetch('/api/admin/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (r.ok) { say(okMsg); load(); return j } say(j.error ?? '실패', 'err'); return null }
  const remove = async (ids: string[]) => { const r = await fetch('/api/admin/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); if (r.ok) { say(`${ids.length}개 삭제`); setSel(new Set()); setDetail(null); load() } else say('삭제 실패', 'err'); setDel(null) }
  const saveEdited = async (a: Asset, blob: Blob, dims: { w: number; h: number }, asNew: boolean) => {
    const fd = new FormData(); fd.set('id', a.id); fd.set('file', new File([blob], `${a.name}.png`, { type: 'image/png' })); fd.set('dims', JSON.stringify(dims)); if (asNew) fd.set('asNew', '1')
    const r = await fetch('/api/admin/media', { method: 'PATCH', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error ?? '저장 실패')
    say(asNew ? '새 에셋으로 저장했어요.' : '이미지를 덮어썼어요.'); setEditor(null); if (detail && !asNew) setDetail(j.item); load()
  }
  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const items = data?.items ?? []
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 60))

  const header = <PageHeader title="미디어 라이브러리" desc="장르별 캐릭터·배경·아이템·오디오(배경음·효과음)를 모아두면, 게임 생성 시 프롬프트·장르에 맞는 에셋이 자동으로 들어가고 스튜디오에서 직접 고를 수도 있어요. 「장르별」 보기로 카테고리 안을 장르로 묶어 볼 수 있어요."
    actions={<div className="flex items-center gap-2">
      <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,audio/*,.glb,.gltf,.ttf,.otf,.woff,.woff2" onChange={e => { openUpload(e.target.files); e.target.value = '' }} />
      <button onClick={() => fileRef.current?.click()} className={btn.primary}>＋ 업로드</button>
      <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: '격자' }, { value: 'genre', label: '장르별' }, { value: 'list', label: '목록' }]} />
      {view !== 'list' && <Segmented value={size} onChange={pickSize} options={[{ value: 'xs', label: '작게' }, { value: 'sm', label: '보통' }, { value: 'md', label: '크게' }]} />}
    </div>} />
  if (err?.missing) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]"><p className="font-semibold text-[#1f2430] mb-1">테이블이 아직 없어요.</p><p>Supabase SQL 편집기에서 <code className="bg-[#f3f5f8] px-1 rounded">db/migrations/2026-09-11-media-library.sql</code> 을 실행해 주세요 (media_assets 테이블 + media 버킷).</p></Card></div>
  if (err) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{err.msg}</Card></div>
  if (!data) return <div>{header}<Skeleton /></div>
  const st = data.stats
  return (
    <div onDragOver={e => { e.preventDefault(); setDrop(true) }} onDragLeave={() => setDrop(false)} onDrop={e => { e.preventDefault(); setDrop(false); openUpload(e.dataTransfer.files) }}>
      {header}
      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
        {[['전체', Object.values(st.byKind).reduce((a, b) => a + b, 0)], ['캐릭터', st.byKind.character ?? 0], ['배경', st.byKind.background ?? 0], ['아이템·타일', (st.byKind.item ?? 0) + (st.byKind.tile ?? 0)], ['오디오', st.byKind.audio ?? 0], ['용량', fmtBytes(st.totalBytes)]].map(([l, v]) => (
          <Card key={String(l)} className="px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">{l}</p><p className="text-[18px] font-extrabold text-[#1f2430] tabular-nums">{v}</p></Card>
        ))}
      </div>
      {/* 필터 바 */}
      <Card className="p-3 mb-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색 — 제목·키·태그·설명" className={`${input} md:max-w-xs`} />
          <select value={genre} onChange={e => setGenre(e.target.value)} className={`${input} md:w-56`}>
            <option value="">모든 장르</option>
            {[...groups.entries()].map(([grp, gs]) => <optgroup key={grp} label={grp === '기타' ? '장르' : `${grp} 계열`}>{gs.map(g => <option key={g.slug} value={g.slug}>{g.name} ({g.slug})</option>)}</optgroup>)}
          </select>
          <Segmented value={status} onChange={setStatus} options={[{ value: 'active', label: '사용 중' }, { value: 'archived', label: `보관 ${st.archived}` }, { value: 'all', label: '전체' }]} />
          <span className="text-[12px] text-[#6b7280] md:ml-auto">{data.total.toLocaleString()}개</span>
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          {KINDS.map(([v, l, ic]) => <button key={v} onClick={() => setKind(v)} className={`shrink-0 h-7 px-2.5 rounded-full text-[12px] border transition-colors flex items-center gap-1 ${kind === v ? 'bg-[#1f2430] text-white border-[#1f2430]' : 'bg-white text-[#4b5563] border-[#d9dde5] hover:border-[#1f2430]'}`}><span>{ic}</span>{l}{v && st.byKind[v] ? <span className="opacity-60">{st.byKind[v]}</span> : null}</button>)}
        </div>
      </Card>
      {/* 선택 동작 */}
      {sel.size > 0 && (
        <div className="sticky top-2 z-30 mb-3 rounded-lg bg-[#1f2430] text-white px-3 py-2 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-[12.5px] font-semibold">{sel.size}개 선택</span>
          <button onClick={() => setBulk({ genres: [], tags: '' })} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px]">장르·태그 추가</button>
          <button onClick={() => patch({ ids: [...sel], auto_use: true }, '자동 사용 켬')} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px]">자동 사용 켜기</button>
          <button onClick={() => patch({ ids: [...sel], auto_use: false }, '자동 사용 끔')} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px]">자동 사용 끄기</button>
          <button onClick={() => patch({ ids: [...sel], status: status === 'archived' ? 'active' : 'archived' }, status === 'archived' ? '복원했어요' : '보관했어요').then(() => setSel(new Set()))} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px]">{status === 'archived' ? '복원' : '보관'}</button>
          <button onClick={() => setDel([...sel])} className="h-7 px-2.5 rounded-md bg-[#dc2626] hover:bg-[#b91c1c] text-[12px]">삭제</button>
          <button onClick={() => setSel(new Set(items.map(i => i.id)))} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px] ml-auto">페이지 전체 선택</button>
          <button onClick={() => setSel(new Set())} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-[12px]">해제</button>
        </div>
      )}
      {/* 본문 */}
      {items.length === 0 ? (
        <Card className="p-2"><EmptyState icon="🗂️" title="아직 에셋이 없어요" desc="파일을 여기로 끌어다 놓거나 업로드 버튼을 눌러 캐릭터·배경·아이템을 추가하세요. PNG(투명) 권장, 게임 주입은 450KB 이하만." action={<button onClick={() => fileRef.current?.click()} className={btn.primary}>＋ 업로드</button>} /></Card>
      ) : view === 'genre' ? (
        <div className="flex flex-col gap-5">
          {(() => {
            const buckets = new Map<string, Asset[]>()
            for (const a of items) { const keys = a.genres.length ? a.genres : ['_none']; for (const k of keys) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(a) } }
            const order = [...buckets.keys()].sort((x, y) => x === '_none' ? 1 : y === '_none' ? -1 : genreName(x).localeCompare(genreName(y), 'ko'))
            return order.map(k => (
              <section key={k}>
                <div className="flex items-center gap-2 mb-2"><h3 className="text-[13px] font-bold text-[#1f2430]">{k === '_none' ? '장르 미지정' : genreName(k)}</h3><span className="text-[11px] text-[#6b7280]">{buckets.get(k)!.length}개</span>{k !== '_none' && <button onClick={() => setGenre(k)} className="text-[11px] text-[#2563eb] hover:underline">이 장르만 보기</button>}</div>
                <div className={GRID}>
                  {buckets.get(k)!.map(a => <AssetCard key={a.id} a={a} size={size} selected={sel.has(a.id)} onOpen={() => setDetail(a)} onToggle={() => toggleSel(a.id)} genreName={genreName} />)}
                </div>
              </section>
            ))
          })()}
        </div>
      ) : view === 'grid' ? (
        <div className={GRID}>
          {items.map(a => <AssetCard key={a.id} a={a} size={size} selected={sel.has(a.id)} onOpen={() => setDetail(a)} onToggle={() => toggleSel(a.id)} genreName={genreName} />)}
        </div>
      ) : (
        <Card className="overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr>{['', '', '제목 / 키', '종류', '크기', '장르', '태그', '자동', '사용'].map((h, i) => <th key={i} className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] px-3 py-2 bg-[#f7f8fa] border-b border-[#e3e6ec]">{h}</th>)}</tr></thead><tbody>
          {items.map(a => <tr key={a.id} className="hover:bg-[#f7f9fc] border-b border-[#eef0f4] cursor-pointer" onClick={() => setDetail(a)}>
            <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggleSel(a.id)} /></td>
            <td className="px-2 py-1.5"><Thumb a={a} className="w-10 h-10 rounded-md" /></td>
            <td className="px-3 py-1.5"><p className="font-semibold text-[#1f2430]">{a.title}</p><p className="text-[11px] text-[#6b7280] font-mono">{a.name}</p></td>
            <td className="px-3 py-1.5"><Badge color={KIND_COLOR[a.kind]}>{kindLabel(a.kind)}</Badge></td>
            <td className="px-3 py-1.5 text-[#6b7280] whitespace-nowrap">{a.kind === 'audio' ? (audioRoleLabel(a.meta?.role) || '—') : a.width ? `${a.width}×${a.height}` : '—'} · {fmtBytes(a.bytes)}</td>
            <td className="px-3 py-1.5 text-[#2563eb]">{a.genres.map(genreName).join(', ')}</td>
            <td className="px-3 py-1.5 text-[#6b7280]">{a.tags.join(', ')}</td>
            <td className="px-3 py-1.5">{a.auto_use ? '✓' : '—'}</td>
            <td className="px-3 py-1.5 tabular-nums">{a.uses}</td>
          </tr>)}
        </tbody></table></Card>
      )}
      {pages > 1 && <div className="flex items-center justify-center gap-2 mt-4 text-[12.5px]"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={btn.ghost}>이전</button><span className="text-[#6b7280]">{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className={btn.ghost}>다음</button></div>}
      {drop && <div className="fixed inset-0 z-[70] bg-[#2563eb]/15 border-4 border-dashed border-[#2563eb] flex items-center justify-center pointer-events-none"><p className="bg-white rounded-xl px-6 py-4 text-[15px] font-bold text-[#2563eb] shadow-xl">여기에 놓으면 업로드돼요</p></div>}

      {/* 업로드 모달 */}
      <Modal open={!!up} onClose={() => !uploading && setUp(null)} title={`업로드 — ${up?.files.length ?? 0}개 파일`} width="max-w-2xl">
        {up && <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">{up.files.slice(0, 12).map((f, i) => <div key={i} className="shrink-0 w-16"><div className="w-16 h-16 rounded-lg bg-[#f3f5f8] flex items-center justify-center overflow-hidden">{f.type.startsWith('image/') ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={URL.createObjectURL(f)} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-2xl">{f.type.startsWith('audio/') ? '🎵' : '📦'}</span>}</div><p className="text-[10px] text-[#6b7280] truncate mt-0.5">{f.name}</p></div>)}{up.files.length > 12 && <span className="text-[12px] text-[#6b7280] self-center">+{up.files.length - 12}</span>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>종류</label><select value={up.kind} onChange={e => setUp({ ...up, kind: e.target.value as Kind })} className={input}><option value="">자동 감지 (이미지는 기타)</option>{KINDS.filter(k => k[0]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            {(up.kind === 'audio' || up.files.every(f => f.type.startsWith('audio/'))) && <div><label className={labelCls}>오디오 역할 (AI 가 재생 시점을 정해요)</label><select value={up.role} onChange={e => setUp({ ...up, role: e.target.value })} className={input}><option value="">선택 안 함</option>{AUDIO_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>}
            {up.files.length === 1 && <div><label className={labelCls}>제목</label><input value={up.title} onChange={e => setUp({ ...up, title: e.target.value })} className={input} /></div>}
            {up.files.length === 1 && <div><label className={labelCls}>키 (코드에서 쓰는 이름, 영문)</label><input value={up.name} onChange={e => setUp({ ...up, name: e.target.value })} placeholder="비우면 파일명으로" className={input} /></div>}
            <div className="col-span-2"><label className={labelCls}>태그 (쉼표)</label><input value={up.tags} onChange={e => setUp({ ...up, tags: e.target.value })} placeholder="기사, 검, 픽셀, 어두운, 판타지" className={input} /></div>
            <div className="col-span-2"><label className={labelCls}>설명 (AI 가 용도를 이해하는 데 써요)</label><input value={up.description} onChange={e => setUp({ ...up, description: e.target.value })} placeholder="오른쪽을 보는 파란 갑옷 기사, 4프레임 걷기" className={input} /></div>
          </div>
          <GenrePicker genres={genres} groups={groups} value={up.genres} onChange={g => setUp({ ...up, genres: g })} />
          <Toggle checked={up.auto} onChange={v => setUp({ ...up, auto: v })} label="프롬프트·장르가 맞으면 자동으로 게임에 넣기" />
          <div className="flex justify-end gap-2"><button onClick={() => setUp(null)} className={btn.ghost} disabled={uploading}>취소</button><button onClick={doUpload} className={btn.primary} disabled={uploading}>{uploading ? '업로드 중…' : `${up.files.length}개 업로드`}</button></div>
        </div>}
      </Modal>

      {/* 일괄 장르·태그 */}
      <Modal open={!!bulk} onClose={() => setBulk(null)} title={`${sel.size}개에 장르·태그 추가`} width="max-w-xl">
        {bulk && <div className="flex flex-col gap-3">
          <GenrePicker genres={genres} groups={groups} value={bulk.genres} onChange={g => setBulk({ ...bulk, genres: g })} />
          <div><label className={labelCls}>태그 추가 (쉼표)</label><input value={bulk.tags} onChange={e => setBulk({ ...bulk, tags: e.target.value })} className={input} /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setBulk(null)} className={btn.ghost}>취소</button><button onClick={() => patch({ ids: [...sel], addGenres: bulk.genres, addTags: bulk.tags.split(',').map(x => x.trim()).filter(Boolean) }, '추가했어요').then(() => setBulk(null))} className={btn.primary}>추가</button></div>
        </div>}
      </Modal>

      {/* 상세/편집 */}
      {detail && <DetailModal key={detail.id + detail.url} a={detail} genres={genres} groups={groups} onClose={() => setDetail(null)} onPatch={async body => { const j = await patch({ id: detail.id, ...body }); if (j?.items?.[0]) setDetail(j.items[0]) }} onDelete={() => setDel([detail.id])} onEdit={() => setEditor(detail)} onDuplicate={async () => { const r = await fetch(detail.url); const b = await r.blob(); const fd = new FormData(); fd.set('id', detail.id); fd.set('file', new File([b], `${detail.name}.png`, { type: b.type })); fd.set('asNew', '1'); fd.set('dims', JSON.stringify({ w: detail.width, h: detail.height })); const rr = await fetch('/api/admin/media', { method: 'PATCH', body: fd }); if (rr.ok) { say('복제했어요'); load() } else say('복제 실패', 'err') }} />}
      {editor && <MediaEditor open url={editor.url} title={editor.title} onClose={() => setEditor(null)} onSave={(b, d, n) => saveEdited(editor, b, d, n)} />}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove(del)} title={`${del?.length ?? 0}개 삭제`} desc="스토리지 파일까지 지워져요. 이미 만들어진 게임에는 영향이 없지만(인라인 저장) 새 게임에는 더 이상 쓰이지 않아요." />
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}

function AssetCard({ a, size, selected, onOpen, onToggle, genreName }: { a: Asset; size: 'xs' | 'sm' | 'md'; selected: boolean; onOpen: () => void; onToggle: () => void; genreName: (s: string) => string }) {
  if (size !== 'md') {
    const xs = size === 'xs'
    return (
      <div className={`group relative rounded-lg bg-white border overflow-hidden transition-shadow hover:shadow-md ${selected ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20' : 'border-[#e3e6ec]'}`} title={`${a.title} · ${kindLabel(a.kind)}${a.width ? ` · ${a.width}×${a.height}` : ''} · ${fmtBytes(a.bytes)}${a.genres.length ? ` · ${a.genres.map(genreName).join(', ')}` : ''}`}>
        <button onClick={onOpen} className="block w-full text-left"><Thumb a={a} className="aspect-square" /></button>
        <label className={`absolute top-1 left-1 w-4 h-4 rounded border bg-white/90 flex items-center justify-center cursor-pointer transition-opacity ${selected ? 'opacity-100 border-[#2563eb]' : 'opacity-0 group-hover:opacity-100 border-[#c5cad4]'}`}><input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" />{selected && <span className="text-[#2563eb] text-[10px] font-bold">✓</span>}</label>
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: KIND_COLOR[a.kind] }} />
        {!a.auto_use && <span className="absolute bottom-[18px] right-1 text-[8px] px-1 rounded bg-[#1f2430]/80 text-white">수동</span>}
        <p className={`px-1.5 ${xs ? 'py-0.5 text-[9.5px]' : 'py-1 text-[11px]'} font-semibold text-[#1f2430] truncate`}>{a.title}</p>
      </div>
    )
  }
  return (
            <div className={`group relative rounded-xl bg-white border overflow-hidden transition-shadow hover:shadow-md ${selected ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20' : 'border-[#e3e6ec]'}`}>
              <button onClick={() => onOpen()} className="block w-full text-left"><Thumb a={a} className="aspect-square" /></button>
              <label className={`absolute top-2 left-2 w-5 h-5 rounded-md border bg-white/90 flex items-center justify-center cursor-pointer transition-opacity ${selected ? 'opacity-100 border-[#2563eb]' : 'opacity-0 group-hover:opacity-100 border-[#c5cad4]'}`}><input type="checkbox" checked={selected} onChange={() => onToggle()} className="sr-only" />{selected && <span className="text-[#2563eb] text-[12px] font-bold">✓</span>}</label>
              <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-white" style={{ background: KIND_COLOR[a.kind] }}>{kindLabel(a.kind)}</span>
              {!a.auto_use && <span className="absolute bottom-[52px] right-2 text-[9.5px] px-1.5 py-0.5 rounded bg-[#1f2430]/80 text-white">수동</span>}
              <div className="px-2.5 py-2">
                <p className="text-[12.5px] font-semibold text-[#1f2430] truncate" title={a.title}>{a.title}</p>
                <p className="text-[10.5px] text-[#6b7280] truncate">{a.kind === 'audio' && a.meta?.role ? `${audioRoleLabel(a.meta.role)} · ` : a.width ? `${a.width}×${a.height} · ` : ''}{fmtBytes(a.bytes)}{a.uses ? ` · ${a.uses}회` : ''}</p>
                {a.genres.length > 0 && <p className="text-[10px] text-[#2563eb] truncate mt-0.5">{a.genres.map(genreName).join(' · ')}</p>}
              </div>
            </div>
  )
}

function GenrePicker({ genres, groups, value, onChange }: { genres: Genre[]; groups: Map<string, Genre[]>; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('')
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter(x => x !== s) : [...value, s])
  const list = q ? genres.filter(g => g.name.includes(q) || g.slug.includes(q.toLowerCase())) : null
  return (
    <div>
      <div className="flex items-center justify-between mb-1"><label className={labelCls}>장르 (여러 개 선택 · 이 장르 게임을 만들 때 자동 후보)</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="장르 검색" className="h-6 w-32 rounded border border-[#d9dde5] px-2 text-[11px]" /></div>
      {value.length > 0 && <div className="flex flex-wrap gap-1 mb-1.5">{value.map(s => <button key={s} onClick={() => toggle(s)} className="h-6 px-2 rounded-full bg-[#2563eb] text-white text-[11px]">{genres.find(g => g.slug === s)?.name ?? s} ✕</button>)}</div>}
      <div className="max-h-36 overflow-y-auto rounded-md border border-[#e3e6ec] p-2 flex flex-wrap gap-1 bg-[#f7f8fa]">
        {(list ?? [...groups.values()].flat()).filter(g => !value.includes(g.slug)).map(g => <button key={g.slug} onClick={() => toggle(g.slug)} className="h-6 px-2 rounded-full bg-white border border-[#d9dde5] text-[11px] text-[#1f2430] hover:border-[#2563eb]">{g.name}</button>)}
      </div>
    </div>
  )
}

function DetailModal({ a, genres, groups, onClose, onPatch, onDelete, onEdit, onDuplicate }: { a: Asset; genres: Genre[]; groups: Map<string, Genre[]>; onClose: () => void; onPatch: (b: Record<string, unknown>) => Promise<void>; onDelete: () => void; onEdit: () => void; onDuplicate: () => void }) {
  const [f, setF] = useState({ credit_cost: a.credit_cost ?? 0, title: a.title, name: a.name, description: a.description ?? '', kind: a.kind as Kind, genres: a.genres, tags: a.tags.join(', '), auto_use: a.auto_use, cols: a.meta?.frames?.cols ?? 0, rows: a.meta?.frames?.rows ?? 1, fps: a.meta?.frames?.fps ?? 8, role: a.meta?.role ?? '' })
  const [saving, setSaving] = useState(false)
  const save = async () => { setSaving(true); await onPatch({ credit_cost: Number(f.credit_cost) || 0, title: f.title, name: f.name, description: f.description || null, kind: f.kind, genres: f.genres, tags: f.tags.split(',').map(x => x.trim()).filter(Boolean), auto_use: f.auto_use, meta: { ...a.meta, ...(f.cols > 0 ? { frames: { cols: f.cols, rows: f.rows || 1, fps: f.fps || 8 } } : { frames: undefined }), role: f.role || undefined } }); setSaving(false) }
  const snippet = a.kind === 'audio' ? `playAsset('${a.name}'${f.role === 'bgm' ? ', { loop: true, volume: 0.5 }' : ''})` : `drawAsset(ctx, '${a.name}', x, y${a.width ? `, ${a.width}, ${a.height}` : ''}${f.cols > 0 ? ', frameIndex' : ''})`
  const injectable = ['character', 'background', 'tile', 'item', 'ui', 'effect', 'sprite', 'audio'].includes(a.kind) && a.bytes <= 450_000
  return (
    <Modal open onClose={onClose} title={a.title} width="max-w-4xl">
      <div className="grid md:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div>
          <Thumb a={a} className="rounded-lg h-72 md:h-96" />
          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11.5px] text-[#6b7280]">
            <span>{a.width ? `${a.width}×${a.height}px` : ''}</span><span>{fmtBytes(a.bytes)}</span><span>{a.mime}</span><span>{a.uses}회 사용</span><span>{new Date(a.created_at).toLocaleDateString('ko-KR')}</span>
            {!injectable && <Badge color="#d97706">게임 주입 불가 — {a.bytes > 450_000 ? '450KB 초과 (크기 줄이기)' : '이 종류는 보관·미리보기만'}</Badge>}
          </div>
          <div className="mt-3 rounded-md bg-[#0f1219] text-[#c9d1d9] text-[11.5px] font-mono px-3 py-2 flex items-center justify-between gap-2"><code className="truncate">{snippet}</code><button onClick={() => navigator.clipboard.writeText(snippet)} className="shrink-0 text-[11px] text-[#60a5fa] hover:underline">복사</button></div>
          <div className="flex flex-wrap gap-2 mt-3">
            {isImg(a) && <button onClick={onEdit} className={btn.primary}>✂ 이미지 편집</button>}
            <button onClick={onDuplicate} className={btn.ghost}>복제</button>
            <a href={a.url} target="_blank" rel="noreferrer" className={btn.ghost}>원본 열기</a>
            <button onClick={() => onPatch({ status: a.status === 'archived' ? 'active' : 'archived' })} className={btn.ghost}>{a.status === 'archived' ? '복원' : '보관'}</button>
            <button onClick={onDelete} className={btn.danger}>삭제</button>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div><label className={labelCls}>제목</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className={input} /></div>
          <div><label className={labelCls}>키 (코드 이름)</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={`${input} font-mono`} /></div>
          <div><label className={labelCls}>종류</label><select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as Kind })} className={input}>{KINDS.filter(k => k[0]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className={labelCls}>설명 (AI 용)</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} className={`${input} h-auto py-1.5`} /></div>
          <div><label className={labelCls}>태그 (쉼표)</label><input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} className={input} /></div>
          <div><label className={labelCls}>사용 크레딧 (아이템당) <span className="font-normal text-[#9aa1ad]">— 회원이 이 에셋을 게임에 넣을 때 내는 크레딧, 100% 디자이너에게 적립. 0 = 무료</span></label><input type="number" min={0} value={f.credit_cost} onChange={e => setF({ ...f, credit_cost: Number(e.target.value) })} className={input} /></div>
          <GenrePicker genres={genres} groups={groups} value={f.genres} onChange={g => setF({ ...f, genres: g })} />
          {a.kind === 'audio' && <div><label className={labelCls}>오디오 역할</label><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })} className={input}><option value="">선택 안 함</option>{AUDIO_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>}
          {isImg(a) && <div><label className={labelCls}>스프라이트시트 (프레임 열 × 행 · fps, 0이면 단일 이미지)</label><div className="grid grid-cols-3 gap-2"><input type="number" min={0} value={f.cols} onChange={e => setF({ ...f, cols: Number(e.target.value) })} className={input} placeholder="열" /><input type="number" min={1} value={f.rows} onChange={e => setF({ ...f, rows: Number(e.target.value) })} className={input} placeholder="행" /><input type="number" min={1} value={f.fps} onChange={e => setF({ ...f, fps: Number(e.target.value) })} className={input} placeholder="fps" /></div></div>}
          <Toggle checked={f.auto_use} onChange={v => setF({ ...f, auto_use: v })} label="프롬프트·장르가 맞으면 자동 주입" />
          <button onClick={save} className={btn.primary} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </Modal>
  )
}
