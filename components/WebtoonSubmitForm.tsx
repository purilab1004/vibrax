'use client'
// 웹툰 등록 — 제목 · 한 줄 소개 · 컷 이미지 여러 장(순서대로) · 연결할 게임(선택).
// 컷은 업로드 전에 브라우저에서 긴 변 1280px, JPEG 로 줄여 올린다(쇼츠에서 빨리 넘어가게).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game, WebtoonCut } from '@/lib/supabase/types'

const MAX_CUTS = 30
const MAX_EDGE = 1280

type Cut = { id: string; file: File; preview: string; w: number; h: number }

/** 긴 변 MAX_EDGE 로 줄이고 JPEG 으로 다시 그린다 */
async function shrink(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image()
      im.onload = () => res(im); im.onerror = () => rej(new Error('이미지를 읽지 못했어요'))
      im.src = url
    })
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.86))
    if (!blob) throw new Error('이미지를 변환하지 못했어요')
    return { blob, w, h }
  } finally { URL.revokeObjectURL(url) }
}

export default function WebtoonSubmitForm({ userId }: { userId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')
  const [cuts, setCuts] = useState<Cut[]>([])
  const [gameId, setGameId] = useState('')
  const [myGames, setMyGames] = useState<Pick<Game, 'id' | 'title'>[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('games').select('id, title').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => setMyGames((data ?? []) as Pick<Game, 'id' | 'title'>[]))
  }, [userId])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cuts.forEach(c => URL.revokeObjectURL(c.preview)) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX_CUTS - cuts.length
    const picked = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, Math.max(0, room))
    if (!picked.length) return
    setCuts(prev => [...prev, ...picked.map(f => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file: f, preview: URL.createObjectURL(f), w: 0, h: 0 }))])
    setError(null)
  }
  const move = (i: number, dir: -1 | 1) => setCuts(prev => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const next = [...prev]; const t = next[i]; next[i] = next[j]; next[j] = t
    return next
  })
  const remove = (i: number) => setCuts(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, k) => k !== i) })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }
    if (cuts.length < 1) { setError('컷 이미지를 한 장 이상 올려 주세요.'); return }
    setBusy(true); setError(null)
    try {
      const uploaded: WebtoonCut[] = []
      for (let i = 0; i < cuts.length; i++) {
        setProgress(`컷 올리는 중 ${i + 1}/${cuts.length}`)
        const { blob, w, h } = await shrink(cuts[i].file)
        const path = `webtoons/${userId}/${Date.now()}-${i}.jpg`
        const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
        if (upErr) throw new Error(`이미지 업로드 실패: ${upErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
        uploaded.push({ url: publicUrl, w, h })
      }
      setProgress('저장 중…')
      const { data, error: insErr } = await supabase.from('webtoons').insert([{
        user_id: userId, title: title.trim(), intro: intro.trim() || null,
        cuts: uploaded, thumbnail_url: uploaded[0].url, game_id: gameId || null, published: true,
      }] as never).select('id').maybeSingle()
      if (insErr) throw new Error(insErr.message)
      router.push(`/games?webtoon=${(data as { id: string } | null)?.id ?? ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했어요.')
      setBusy(false); setProgress('')
    }
  }

  const input = 'w-full h-11 rounded-xl border border-[#ddd3bf] px-3.5 text-[14px] outline-none focus:border-[#2563eb] bg-white'
  const label = 'block text-[12.5px] font-bold text-[#4a4337] mb-1.5'

  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      <div>
        <label className={label}>제목</label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="예: 급똥 계단 오르기 — 그날의 진실" className={input} />
      </div>
      <div>
        <label className={label}>한 줄 소개 <span className="font-medium text-[#9d9280]">(쇼츠 하단에 표시, 비워도 됨)</span></label>
        <input value={intro} onChange={e => setIntro(e.target.value)} maxLength={80} placeholder="예: 3화 — 계단 끝에서 만난 것" className={input} />
      </div>

      <div>
        <label className={label}>컷 이미지 <span className="font-medium text-[#9d9280]">(보는 순서대로 · 최대 {MAX_CUTS}장)</span></label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className="rounded-2xl border-2 border-dashed border-[#ddd3bf] hover:border-[#2563eb] transition-colors p-6 text-center cursor-pointer bg-white"
        >
          <p className="text-[14px] font-bold text-[#241f17]">컷을 끌어다 놓거나 눌러서 고르세요</p>
          <p className="mt-1 text-[12px] text-[#9d9280]">여러 장을 한 번에 고를 수 있어요 · 올린 순서대로 보여요</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        {cuts.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {cuts.map((c, i) => (
              <li key={c.id} className="relative rounded-xl overflow-hidden border border-[#ebe4d6] bg-[#f8f6f1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.preview} alt="" className="w-full aspect-[3/4] object-cover" />
                <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-[11px] font-bold grid place-items-center">{i + 1}</span>
                <div className="absolute inset-x-0 bottom-0 flex">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex-1 h-7 bg-black/60 text-white text-[12px] disabled:opacity-30">←</button>
                  <button type="button" onClick={() => remove(i)} className="flex-1 h-7 bg-black/60 text-white text-[12px]">✕</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === cuts.length - 1} className="flex-1 h-7 bg-black/60 text-white text-[12px] disabled:opacity-30">→</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className={label}>게임 연결 <span className="font-medium text-[#9d9280]">(선택 — 웹툰을 다 보면 그 게임으로 갈 수 있어요)</span></label>
        <select value={gameId} onChange={e => setGameId(e.target.value)} className={input}>
          <option value="">연결 안 함</option>
          {myGames.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>

      {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className="h-12 px-6 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-[14px] font-extrabold transition-colors">
          {busy ? (progress || '올리는 중…') : '웹툰 쇼츠 올리기'}
        </button>
        <span className="text-[12.5px] text-[#9d9280]">{cuts.length}컷</span>
      </div>
    </form>
  )
}
