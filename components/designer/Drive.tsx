'use client'
// 내 드라이브 — 구글 드라이브처럼 폴더·파일(이미지·3D·오디오)을 보관. 끌어 놓기 업로드, 이름 바꾸기·이동·삭제,
// 이미지 → 3D 만들기, 갤러리 공개 신청(관리자 승인 후 공개)
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GlbViewer } from './GlbViewer'
import { MotionChips, RigButton } from './RigControls'
import { ui, isImage, isGlb, isAudio, fmtSize, rigBadge, type DriveFile, type Source3D } from './shared'

const KINDS: [string, string][] = [['character', '캐릭터'], ['background', '배경'], ['tile', '타일·맵'], ['item', '아이템'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트']]
const post = (body: object) => fetch('/api/designer/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }))

export default function Drive({ refresh, onMake3D }: { refresh: number; onMake3D: (s: Source3D) => void }) {
  const [folder, setFolder] = useState('')
  const [folders, setFolders] = useState<{ name: string }[]>([])
  const [files, setFiles] = useState<DriveFile[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [view, setView] = useState<DriveFile | null>(null)
  const [motion, setMotion] = useState('idle')
  const [rigged, setRigged] = useState(false)
  const [publish, setPublish] = useState<DriveFile | null>(null)
  const [pub, setPub] = useState({ kind: 'character', title: '', tags: '', description: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (f = folder) => {
    const j = await fetch('/api/designer/drive?folder=' + encodeURIComponent(f)).then((r) => r.json()).catch(() => null)
    if (!j || j.error) { setMsg(j?.error ?? '불러오지 못했어요'); setFiles([]); return }
    if (!f) setFolders(j.folders ?? [])
    setFiles(j.files ?? []); setSel(new Set())
  }, [folder])
  useEffect(() => { const t = setTimeout(() => { void load(folder) }, 0); return () => clearTimeout(t) }, [folder, refresh, load])
  // 폴더 목록은 루트에서 받는다
  useEffect(() => { if (folder) fetch('/api/designer/drive').then((r) => r.json()).then((j) => setFolders(j.folders ?? [])).catch(() => {}) }, [folder, refresh])

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? null : x)), 3500) }
  const upload = async (list: FileList | File[]) => {
    const arr = Array.from(list).slice(0, 30)
    if (!arr.length) return
    const sb = createClient()
    let n = 0
    for (const [i, f] of arr.entries()) {
      setBusy(`올리는 중 ${i + 1}/${arr.length}`)
      if (f.size > 50_000_000) { say(`${f.name}: 50MB 를 넘어요`); continue }
      const u = await post({ action: 'upload_url', folder, name: f.name })
      if (!u.ok) { say(`${f.name}: ${u.error ?? '실패'}`); continue }
      const { error } = await sb.storage.from('media').uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined })
      if (error) say(`${f.name}: ${error.message}`); else n++
    }
    setBusy(null); if (n) say(`${n}개 올렸어요`); load()
  }
  const mkdir = async () => {
    const name = prompt('새 폴더 이름')?.trim()
    if (!name) return
    const r = await post({ action: 'mkdir', folder: name })
    if (!r.ok) say(r.error ?? '실패'); else { setFolder(name) }
  }
  const rmdir = async () => {
    if (!folder || !confirm(`‘${folder}’ 폴더와 안의 파일을 모두 지울까요?`)) return
    await post({ action: 'rmdir', folder }); setFolder('')
  }
  const del = async (keys: string[]) => {
    if (!keys.length || !confirm(`${keys.length}개 파일을 지울까요? 되돌릴 수 없어요.`)) return
    const r = await post({ action: 'delete', keys }); if (!r.ok) say(r.error ?? '실패'); else { say('지웠어요'); setView(null); load() }
  }
  const rename = async (f: DriveFile) => {
    const name = prompt('새 이름', f.name.replace(/\.[a-z0-9]+$/i, ''))?.trim()
    if (!name) return
    const r = await post({ action: 'rename', key: f.key, name }); if (!r.ok) say(r.error ?? '실패'); else { setView(null); load() }
  }
  const move = async (keys: string[]) => {
    const to = prompt(`옮길 폴더 이름 (비우면 맨 위, 없으면 새로 만들어요)\n있는 폴더: ${folders.map((f) => f.name).join(', ') || '없음'}`)
    if (to === null) return
    const r = await post({ action: 'move', keys, folder: to.trim() }); if (!r.ok) say(r.error ?? '실패'); else { say('옮겼어요'); load() }
  }
  const doPublish = async () => {
    if (!publish) return
    setBusy('공개 신청 중…')
    const r = await post({ action: 'publish', key: publish.key, ...pub })
    setBusy(null)
    if (!r.ok) { say(r.error ?? '실패'); return }
    say(r.asset?.status === 'active' ? '갤러리에 공개했어요' : '공개 신청했어요 — 관리자 승인 후 갤러리에 보여요'); setPublish(null)
  }

  const shown = (files ?? []).filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="flex flex-col gap-4"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false) }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files) }}>
      {/* 도구 줄 */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1 text-[15px] font-extrabold text-[#241f17] mr-auto min-w-0">
          <button onClick={() => setFolder('')} className={folder ? 'text-[#9d9280] hover:text-[#241f17]' : ''}>내 드라이브</button>
          {folder && <><span className="text-[#cfc4ab]">›</span><span className="truncate">📁 {folder}</span></>}
        </nav>
        <div className="relative w-full sm:w-[220px] order-last sm:order-none">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="파일 이름 검색" className={`${ui.input} h-10 pl-9`} />
          <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b3a993]" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </div>
        <button onClick={mkdir} className={ui.ghost}>＋ 새 폴더</button>
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className={ui.primary}>⬆ 업로드</button>
        <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,.glb,audio/*" className="hidden" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = '' }} />
      </div>

      {/* 폴더 */}
      {!folder && folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {folders.map((f) => (
            <button key={f.name} onClick={() => setFolder(f.name)} className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl bg-white border border-[#ebe4d6] hover:border-[#2563eb] hover:bg-[#f5f8ff] text-left transition-colors">
              <span className="text-[20px]">📁</span><span className="text-[13px] font-bold text-[#241f17] truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {(msg || busy) && <p className="text-[12.5px] font-semibold text-[#2563eb]">{busy ?? msg}</p>}

      {/* 선택 동작 */}
      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-[#241f17] text-white px-3 py-2">
          <span className="text-[13px] font-bold mr-auto">{sel.size}개 선택</span>
          <button onClick={() => move([...sel])} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-bold">폴더로 옮기기</button>
          <button onClick={() => del([...sel])} className="h-8 px-3 rounded-lg bg-[#dc2626] text-[12.5px] font-bold">삭제</button>
          <button onClick={() => setSel(new Set())} className="h-8 px-2 text-[12.5px] text-white/70">취소</button>
        </div>
      )}

      {/* 파일 */}
      <div className={`relative rounded-2xl min-h-[360px] transition-colors ${drag ? 'bg-[#eef4ff] ring-2 ring-dashed ring-[#2563eb]' : ''}`}>
        {drag && <p className="absolute inset-0 z-10 flex items-center justify-center text-[15px] font-extrabold text-[#2563eb]">여기에 놓으면 {folder ? `‘${folder}’ 에` : '내 드라이브에'} 올라가요</p>}
        {files === null ? <p className="py-20 text-center text-[13px] text-[#9d9280]">불러오는 중…</p>
          : shown.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center rounded-2xl border-2 border-dashed border-[#e6dfd0]">
              <p className="text-[40px]">🗂</p>
              <p className="mt-2 text-[14px] font-bold text-[#241f17]">{q ? '찾는 파일이 없어요' : '아직 파일이 없어요'}</p>
              <p className="mt-1 text-[12.5px] text-[#9d9280]">이미지·GLB·오디오를 끌어 놓거나, AI 로 만들어 저장해 보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {shown.map((f) => (
                <div key={f.key} className={`group relative rounded-xl overflow-hidden bg-white border transition-all ${sel.has(f.key) ? 'border-[#2563eb] ring-2 ring-[#2563eb]/25' : 'border-[#ebe4d6] hover:border-[#cfc4ab] hover:shadow-md'}`}>
                  <button onClick={() => { setRigged(f.rig === 'anim' || f.rig === 'bones'); setMotion('idle'); setView(f) }} className={`block w-full aspect-square ${ui.checker} flex items-center justify-center overflow-hidden`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {isImage(f.name) ? <img src={f.url} alt={f.name} loading="lazy" className="w-full h-full object-contain" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : isGlb(f.name) ? (f.thumb ? <img src={f.thumb} alt={f.name} loading="lazy" className="w-full h-full object-contain" /> : <span className="text-[40px]">🧊</span>)
                      : <span className="text-[40px]">{isAudio(f.name) ? '🎵' : '📄'}</span>}
                  </button>
                  <input type="checkbox" checked={sel.has(f.key)} onChange={() => toggle(f.key)} aria-label="선택"
                    className={`absolute top-2 left-2 w-4.5 h-4.5 accent-[#2563eb] ${sel.size ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
                  {isGlb(f.name) && <span className="absolute top-2 right-2 flex gap-1">{rigBadge(f.rig) && <span className="text-[10px] font-extrabold bg-[#16a34a] text-white rounded px-1.5 py-0.5">{rigBadge(f.rig)}</span>}<span className="text-[10px] font-extrabold bg-[#241f17] text-white rounded px-1.5 py-0.5">3D</span></span>}
                  <div className="px-2.5 py-2">
                    <p className="text-[12.5px] font-bold text-[#241f17] truncate" title={f.name}>{f.name}</p>
                    <p className="text-[10.5px] text-[#9d9280]">{fmtSize(f.size)}{f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      {folder && <button onClick={rmdir} className="self-start text-[12px] text-[#b91c1c] hover:underline">이 폴더 지우기</button>}

      {/* 미리보기 */}
      {view && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setView(null)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`${ui.checker} flex items-center justify-center h-[52vh] max-h-[460px]`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {isImage(view.name) ? <img src={view.url} alt={view.name} className="max-w-full max-h-full object-contain" />
                : isGlb(view.name) ? <div className="w-full h-full"><GlbViewer key={view.url} url={view.url} motion={motion} onRigged={setRigged} /></div>
                : isAudio(view.name) ? <audio src={view.url} controls className="w-[90%]" /> : <span className="text-[48px]">📄</span>}
            </div>
            <div className="p-4">
              <p className="text-[15px] font-extrabold text-[#241f17] truncate">{view.name}</p>
              <p className="text-[12px] text-[#9d9280]">{fmtSize(view.size)} · {view.mime}{isGlb(view.name) ? (rigged ? ' · 🦴 뼈대 있음 (팔다리까지 움직여요)' : ' · 뼈대 없음 (몸 전체만 움직여요)') : ''}</p>
              {isGlb(view.name) && <div className="mt-2"><MotionChips value={motion} onChange={setMotion} /></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {isGlb(view.name) && !rigged && <RigButton driveKey={view.key} onDone={(f) => { load(); setRigged(true); setMotion('walk'); setView({ ...view, key: f.key, name: f.name, url: f.url }) }} />}
                {isImage(view.name) && <button onClick={() => { onMake3D({ kind: 'drive', key: view.key, url: view.url, name: view.name }); setView(null) }} className={ui.primary}>🧊 3D로 만들기</button>}
                {!isAudio(view.name) && <button onClick={() => { setPub({ kind: 'character', title: view.name.replace(/\.[a-z0-9]+$/i, ''), tags: '', description: '' }); setPublish(view); setView(null) }} className={ui.ghost}>🌐 갤러리에 공개 신청</button>}
                <a href={view.url} download={view.name} className={ui.ghost}>⬇ 다운로드</a>
                <button onClick={() => rename(view)} className={ui.ghost}>이름 바꾸기</button>
                <button onClick={() => { move([view.key]); setView(null) }} className={ui.ghost}>옮기기</button>
                <button onClick={() => del([view.key])} className={`${ui.ghost} !text-[#b91c1c]`}>삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공개 신청 */}
      {publish && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setPublish(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-extrabold text-[#241f17]">갤러리에 공개 신청</h3>
            <p className="text-[12.5px] text-[#6b6152] mt-1" style={{ wordBreak: 'keep-all' }}>관리자가 확인하면 갤러리에 공개되고, 회원이 게임에 쓸 때마다 크레딧이 100% 쌓여요.</p>
            <div className="mt-4 space-y-2">
              {!isGlb(publish.name) && <div className="flex flex-wrap gap-1.5">{KINDS.map(([v, l]) => <button key={v} onClick={() => setPub({ ...pub, kind: v })} className={ui.chip(pub.kind === v)}>{l}</button>)}</div>}
              <input value={pub.title} onChange={(e) => setPub({ ...pub, title: e.target.value })} placeholder="제목" className={ui.input} />
              <input value={pub.tags} onChange={(e) => setPub({ ...pub, tags: e.target.value })} placeholder="태그 (쉼표로: 픽셀, 우주, 귀여움)" className={ui.input} />
              <input value={pub.description} onChange={(e) => setPub({ ...pub, description: e.target.value })} placeholder="설명 (AI 가 어떤 게임에 쓸지 판단하는 힌트)" className={ui.input} />
            </div>
            <div className="mt-4 flex gap-2"><button onClick={doPublish} disabled={!!busy || !pub.title.trim()} className={`${ui.primary} flex-1 h-11`}>신청하기</button><button onClick={() => setPublish(null)} className={`${ui.ghost} h-11`}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
