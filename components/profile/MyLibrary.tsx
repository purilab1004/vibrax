'use client'
// 내 정보 › 라이브러리 — 디자이너가 자기 작품을 올리고(승인 대기 → 공개) 상태·사용 횟수·쌓인 크레딧을 본다.
// 디자이너가 아니면 접수 안내를 보여준다.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Mine { id: string; kind: string; name: string; title: string; url: string; width: number | null; height: number | null; status: string; uses: number | null; credit_earned: number | null; created_at: string }
const KINDS: [string, string][] = [['character', '캐릭터'], ['background', '배경'], ['tile', '타일·맵'], ['item', '아이템'], ['ui', 'UI'], ['effect', '이펙트'], ['sprite', '스프라이트'], ['audio', '오디오']]
const STATUS: Record<string, { label: string; cls: string }> = { pending: { label: '승인 대기', cls: 'bg-[#fff4d6] text-[#8a5a00]' }, active: { label: '공개 중', cls: 'bg-[#dcfce7] text-[#15803d]' }, rejected: { label: '반려', cls: 'bg-[#fee2e2] text-[#b91c1c]' }, archived: { label: '보관', cls: 'bg-[#f1ece2] text-[#6b6152]' } }

export default function MyLibrary() {
  const [items, setItems] = useState<Mine[] | null>(null)
  const [role, setRole] = useState<string>('user')
  const [kind, setKind] = useState('character'); const [tags, setTags] = useState(''); const [desc, setDesc] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const load = () => fetch('/api/library/upload').then((r) => r.json()).then((j) => { setItems(j.items ?? []); setRole(j.role ?? 'user') }).catch(() => setItems([]))
  useEffect(() => { load() }, [])
  const isDesigner = role === 'designer' || role === 'admin'
  const totalCredit = (items ?? []).reduce((a, b) => a + (b.credit_earned ?? 0), 0)
  const totalUses = (items ?? []).reduce((a, b) => a + (b.uses ?? 0), 0)

  const upload = async () => {
    if (!files.length || busy) return
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData(); files.forEach((f) => fd.append('files', f)); fd.append('kind', kind); fd.append('tags', tags); fd.append('description', desc)
      const r = await fetch('/api/library/upload', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error ?? '업로드 실패'); return }
      setMsg(`${(j.items ?? []).length}개 등록됐어요 — 관리자 승인 후 공개돼요.${(j.errors ?? []).length ? ' 실패: ' + j.errors.join(' / ') : ''}`)
      setFiles([]); if (fileRef.current) fileRef.current.value = ''
      load()
    } catch { setMsg('네트워크 오류') } finally { setBusy(false) }
  }

  return (
    <section id="library" className="rounded-2xl bg-white p-4 sm:p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#241f17]">라이브러리</h2>
          <p className="text-[12.5px] text-[#6b6152] mt-0.5" style={{ wordBreak: 'keep-all' }}>내가 등록한 디자인과 쌓인 크레딧. 회원이 내 디자인으로 게임을 만들면 그 크레딧이 <b>100% 나에게</b> 쌓여요.</p>
        </div>
        <Link href="/library" className="shrink-0 text-[12.5px] font-semibold text-[#7c3aed]">공개 라이브러리 →</Link>
      </div>

      {!isDesigner ? (
        <div className="rounded-2xl border border-dashed border-[#ddd3bf] bg-[#faf8f3] p-8 text-center" style={{ wordBreak: 'keep-all' }}>
          <p className="text-[28px]">🎨</p>
          <p className="text-[15px] font-bold text-[#241f17] mt-1">아직 디자이너가 아니에요</p>
          <p className="text-[12.5px] text-[#857a68] mt-1 mb-4">일반 회원 누구나 접수할 수 있어요. 관리자가 확인하면 디자이너로 전환되고 여기서 작품을 올릴 수 있습니다.</p>
          <Link href="/library" className="inline-flex items-center h-10 px-5 rounded-lg bg-[#7c3aed] text-white text-[13px] font-semibold">디자이너 접수하러 가기</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[['등록 작품', (items ?? []).length], ['게임에 쓰인 횟수', totalUses], ['쌓인 크레딧', totalCredit]].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl bg-[#faf8f3] border border-[#ebe4d6] px-3 py-3 text-center"><p className="text-[11px] text-[#9d9280] font-semibold">{l}</p><p className="text-[20px] font-extrabold text-[#241f17] tabular-nums">{Number(v).toLocaleString()}</p></div>
            ))}
          </div>
          <div className="rounded-2xl border border-[#ebe4d6] p-4 mb-5">
            <p className="text-[13px] font-bold text-[#241f17] mb-2">작품 올리기 <span className="text-[11px] font-normal text-[#9d9280]">이미지(PNG/WebP/JPG)·오디오, 최대 10개 · 8MB · 배경은 세로 9:16 권장</span></p>
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-lg border border-[#ddd3bf] px-3 text-[13px] bg-white">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="태그 (쉼표로 구분: 픽셀, 우주, 귀여움)" className="h-10 rounded-lg border border-[#ddd3bf] px-3 text-[13px]" />
            </div>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="설명 (선택) — AI 가 어떤 게임에 쓸지 판단하는 힌트" className="mt-2 w-full h-10 rounded-lg border border-[#ddd3bf] px-3 text-[13px]" />
            <input ref={fileRef} type="file" multiple accept="image/*,audio/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="mt-2 w-full text-[12.5px] text-[#6b6152] file:mr-3 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-[#7c3aed] file:text-white file:text-[12px] file:font-semibold" />
            {msg && <p className="mt-2 text-[12.5px] font-semibold text-[#7c3aed]">{msg}</p>}
            <button onClick={upload} disabled={busy || !files.length} className="mt-3 h-10 px-5 rounded-lg bg-[#241f17] text-white text-[13px] font-semibold disabled:opacity-40">{busy ? '올리는 중…' : `${files.length ? files.length + '개 ' : ''}등록 (승인 요청)`}</button>
          </div>
          {items === null ? <p className="text-[13px] text-[#9d9280]">불러오는 중…</p> : items.length === 0 ? <p className="text-[13px] text-[#9d9280] py-6 text-center">아직 올린 작품이 없어요.</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((a) => (
                <div key={a.id} className="rounded-xl overflow-hidden border border-[#ebe4d6] bg-white">
                  <div className="aspect-square bg-[repeating-conic-gradient(#f3f0e8_0_25%,#fff_0_50%)] bg-[length:14px_14px] flex items-center justify-center">
                    {a.kind === 'audio' ? <span className="text-3xl">🎵</span> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.title} className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="flex items-center justify-between gap-1"><p className="text-[12.5px] font-bold text-[#241f17] truncate">{a.title}</p><span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS[a.status]?.cls ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span></div>
                    <p className="text-[10.5px] text-[#9d9280] truncate">{a.name} · 사용 {a.uses ?? 0} · 크레딧 {(a.credit_earned ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
