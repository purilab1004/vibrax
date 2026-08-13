'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

// 스튜디오 — 게임 제목/카드 훅 문구 수정 모달.
// 게시된 게임(games.studio_project_id)이 있으면 게임 제목·훅 문구도 함께 갱신한다.
export default function EditInfoModal({ projectId, initialTitle, onClose, onSaved }: {
  projectId: string
  initialTitle: string
  onClose: () => void
  onSaved: (title: string) => void
}) {
  const supabase = createClient()
  const [title, setTitle] = useState(initialTitle)
  const [teaser, setTeaser] = useState('')
  const [gameId, setGameId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    supabase.from('games').select('id, title, teaser').eq('studio_project_id', projectId).maybeSingle()
      .then(({ data }) => {
        const g = data as { id: string; title: string; teaser?: string | null } | null
        if (g) {
          setGameId(g.id)
          setTitle(g.title)
          setTeaser(g.teaser ?? '')
        }
      })
  }, [projectId])

  const save = () => {
    const t = title.trim()
    if (!t) { setError('제목을 입력해주세요'); return }
    setError(null)
    startTransition(async () => {
      const { error: e1 } = await supabase.from('studio_projects').update({ title: t } as never).eq('id', projectId)
      if (e1) { setError(e1.message); return }
      if (gameId) {
        const { error: e2 } = await supabase.from('games')
          .update({ title: t, teaser: teaser.trim() || null } as never)
          .eq('id', gameId)
        if (e2 && !e2.message.includes('teaser')) { setError(e2.message); return }
      }
      onSaved(t)
      onClose()
    })
  }

  const inputClass = 'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-2.5 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#fcfaf5] border border-[#ddd3bf] max-h-[90svh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe4d6]">
          <p className="font-pixel text-[11px] text-[#2563eb] tracking-widest">게임 정보 수정</p>
          <button onClick={onClose} className="font-pixel text-[11px] text-[#857a68] hover:text-[#241f17] transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">제목</label>
            <input className={inputClass} value={title} maxLength={60} onChange={e => setTitle(e.target.value)} />
          </div>
          {gameId ? (
            <div>
              <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">
                카드 훅 문구 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(카드 앞면에 표시 — 비워두면 기본 문구)</span>
              </label>
              <input
                className={inputClass}
                maxLength={40}
                placeholder="예: 멈추면 죽는다 / 왕좌를 뺏어라"
                value={teaser}
                onChange={e => setTeaser(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-[12px] text-[#9d9280]">카드 훅 문구는 게임을 게시한 뒤에 수정할 수 있어요.</p>
          )}
          {error && (
            <p className="text-red-600 text-xs border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={isPending} className="flex-1 font-pixel text-[11px] bg-[#2563eb] text-white py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest">
              {isPending ? 'SAVING...' : 'SAVE'}
            </button>
            <button onClick={onClose} className="flex-1 font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] py-3 hover:border-gray-500 transition-colors tracking-widest">
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
