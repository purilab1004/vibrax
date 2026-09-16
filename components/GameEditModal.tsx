'use client'
// 게시된 게임 정보 수정 — 프로필(내 게임)과 스튜디오 목록에서 같은 모달을 쓴다.
// 썸네일(업로드·기본 썸네일 재생성), 제목, 훅 문구, 언어, 국가, AJ 설명, 메뉴얼(.md), 장르, 플레이 URL
import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { generateThumbnail } from '@/lib/thumbnail'
import { COUNTRIES } from '@/lib/countries'
import type { Genre } from '@/lib/supabase/types'

const LANGUAGES = [{ value: 'ko', label: '한국어' }, { value: 'en', label: 'English' }]
const GENRES: { value: Genre; label: string }[] = [{ value: 'action', label: 'ACTION' }, { value: 'adventure', label: 'ADVENTURE' }, { value: 'strategy', label: 'STRATEGY' }, { value: 'sports', label: 'SPORTS' }]

export interface GameEditPatch { id: string; title: string; genre: Genre; description: string | null; language: string | null; country: string | null; game_manual: string | null; play_url: string; thumbnail_url: string; teaser: string | null }
interface Form { title: string; genre: Genre; description: string; language: string; country: string; game_manual: string; play_url: string; thumbnail_url: string; teaser: string; newThumbnail: File | null; newManual: File | null }

export default function GameEditModal({ gameId, userId, onClose, onSaved }: { gameId: string; userId: string; onClose: () => void; onSaved: (g: GameEditPatch) => void }) {
  const supabase = createClient()
  const [f, setF] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [regen, setRegen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputClass = 'w-full h-10 rounded-lg bg-white border border-[#ddd3bf] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 px-3.5 text-[14px] outline-none transition text-[#241f17] placeholder:text-[#b3a78f]'

  useEffect(() => {
    supabase.from('games').select('id,title,genre,description,language,country,game_manual,play_url,thumbnail_url,teaser').eq('id', gameId).maybeSingle().then(({ data, error }) => {
      if (error || !data) { setError(error?.message ?? '게임을 찾을 수 없어요'); return }
      const g = data as Omit<GameEditPatch, 'id'> & { id: string }
      setF({ title: g.title, genre: g.genre, description: g.description ?? '', language: g.language ?? 'ko', country: g.country ?? '', game_manual: g.game_manual ?? '', play_url: g.play_url, thumbnail_url: g.thumbnail_url, teaser: g.teaser ?? '', newThumbnail: null, newManual: null })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  const set = (patch: Partial<Form>) => setF(prev => prev ? { ...prev, ...patch } : prev)
  const regenThumb = async () => {
    if (!f) return
    setRegen(true)
    try { const blob = await generateThumbnail(f.title || '게임', f.genre); set({ newThumbnail: new File([blob], 'default-thumbnail.png', { type: 'image/png' }) }) } catch (e) { console.error('[game-edit] regen', e) }
    setRegen(false)
  }
  const save = () => {
    if (!f) return
    if (!f.title.trim()) { setError('제목을 입력해주세요'); return }
    setError(null)
    startTransition(async () => {
      let thumbnailUrl = f.thumbnail_url
      if (f.newThumbnail) {
        const ext = f.newThumbnail.name.split('.').pop() ?? 'png'
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, f.newThumbnail, { upsert: false })
        if (upErr) { setError('썸네일 업로드 실패: ' + upErr.message); return }
        thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl
      }
      let manual = f.game_manual || null
      if (f.newManual) manual = await f.newManual.text()
      const patch: GameEditPatch = { id: gameId, title: f.title.trim(), genre: f.genre, description: f.description.trim() || null, language: f.language || null, country: f.country || null, game_manual: manual, play_url: f.play_url, thumbnail_url: thumbnailUrl, teaser: f.teaser.trim() || null }
      const { id: _id, ...row } = patch; void _id
      const { error: e } = await supabase.from('games').update(row as never).eq('id', gameId)
      if (e) { setError('저장 실패: ' + e.message); return }
      onSaved(patch); onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#241f17]/45 backdrop-blur-[2px] px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#ebe4d6] shadow-2xl max-h-[90svh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe4d6]">
          <p className="text-[15px] font-bold text-[#241f17]">게임 수정</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-[#857a68] hover:bg-[#f4efe6] hover:text-[#241f17] transition-colors">✕</button>
        </div>
        {!f ? <div className="p-8 text-center text-sm text-[#857a68]">{error ?? '불러오는 중…'}</div> : (
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">썸네일</label>
            <div className="relative w-full aspect-video mb-3 overflow-hidden rounded-xl bg-gray-900 border border-[#ebe4d6]">
              <Image src={f.newThumbnail ? URL.createObjectURL(f.newThumbnail) : f.thumbnail_url} alt="thumbnail" fill className="object-cover" unoptimized />
            </div>
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e => set({ newThumbnail: e.target.files?.[0] ?? null })}
              className="w-full bg-white border border-[#ddd3bf] px-4 py-2.5 text-sm text-[#6b6152] file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-[#2563eb] file:text-white file:text-[11px] file:font-pixel file:cursor-pointer file:hover:bg-[#1d4ed8] file:transition-colors" />
            {f.newThumbnail && <p className="text-xs text-[#6b6152] mt-1">선택됨: {f.newThumbnail.name}</p>}
            <button type="button" disabled={regen} onClick={regenThumb} className="mt-2 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#ddd3bf] bg-white text-[12px] font-semibold text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors disabled:opacity-50">
              {regen ? <span className="w-3.5 h-3.5 border-2 border-[#2563eb]/60 border-t-transparent rounded-full animate-spin" /> : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" /></svg>}
              기본 썸네일로 다시 만들기
            </button>
            <p className="text-[11px] text-[#9d9280] mt-1">기본 배경 이미지 위에 제목을 얹어 새로 만듭니다. 미리보기를 확인하고 저장을 누르면 반영됩니다.</p>
          </div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">TITLE</label><input className={inputClass} value={f.title} maxLength={60} onChange={e => set({ title: e.target.value })} /></div>
          <div>
            <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">카드 훅 문구 <span className="text-[#9d9280] font-normal text-[11px]">(카드 앞면에 표시 — 비워두면 기본 문구)</span></label>
            <input className={inputClass} maxLength={40} placeholder="예: 멈추면 죽는다 / 왕좌를 뺏어라" value={f.teaser} onChange={e => set({ teaser: e.target.value })} />
          </div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">게임 언어</label><select className={inputClass} value={f.language} onChange={e => set({ language: e.target.value })}>{LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">게임 국가</label><select className={inputClass} value={f.country} onChange={e => set({ country: e.target.value })}><option value="">선택 안 함</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select></div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">AI AJ 게임 설명</label><textarea rows={3} maxLength={500} className={inputClass + ' !h-auto py-2.5 resize-none'} value={f.description} onChange={e => set({ description: e.target.value })} placeholder="조작 방법, 적, 아이템, 목표 등을 설명해주세요" /></div>
          <div>
            <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">게임 메뉴얼 <span className="text-[#9d9280] font-normal text-[11px]">(.md 파일)</span></label>
            {f.game_manual && !f.newManual && <p className="text-[11px] text-[#2563eb] mb-2">✓ 메뉴얼 등록됨 — 새 파일 업로드 시 교체됩니다</p>}
            <input type="file" accept=".md,text/markdown,text/plain" onChange={e => set({ newManual: e.target.files?.[0] ?? null })} className="w-full bg-white border border-[#ddd3bf] px-4 py-2.5 text-sm text-[#6b6152] file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-[#241f17] file:text-white file:text-[12px] file:font-semibold file:rounded-md file:cursor-pointer file:hover:bg-gray-600 file:transition-colors" />
            {f.newManual && <p className="text-xs text-[#6b6152] mt-1">선택됨: {f.newManual.name}</p>}
          </div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">GENRE</label><select className={inputClass} value={f.genre} onChange={e => set({ genre: e.target.value as Genre })}>{GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
          <div><label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">PLAY URL</label><input className={inputClass} value={f.play_url} onChange={e => set({ play_url: e.target.value })} /></div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={isPending} className="flex-1 h-11 rounded-xl bg-[#2563eb] text-white text-[14px] font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">{isPending ? 'SAVING...' : 'SAVE'}</button>
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-[#ddd3bf] bg-white text-[14px] font-semibold text-[#4a4337] hover:border-[#2563eb] transition-colors">CANCEL</button>
          </div>
        </div>)}
      </div>
    </div>
  )
}
