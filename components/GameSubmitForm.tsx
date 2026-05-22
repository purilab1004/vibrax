'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'

const GENRES: { value: Genre; label: string }[] = [
  { value: 'action', label: 'ACTION' },
  { value: 'adventure', label: 'ADVENTURE' },
  { value: 'strategy', label: 'STRATEGY' },
  { value: 'sports', label: 'SPORTS' },
]

export default function GameSubmitForm({ userId }: { userId: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState<Genre>('action')
  const [playUrl, setPlayUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.submit

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!thumbnailFile) {
      setError(s.thumbnailRequired)
      return
    }
    setError(null)
    startTransition(async () => {
      const ext = thumbnailFile.name.split('.').pop() ?? 'png'
      const path = `${userId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(path, thumbnailFile, { upsert: false })

      if (uploadError) {
        setError(`업로드 실패: ${uploadError.message}`)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('thumbnails').getPublicUrl(path)

      const { error: insertError } = await supabase.from('games').insert([
        {
          title,
          genre,
          description: description.trim() || null,
          play_url: playUrl,
          thumbnail_url: publicUrl,
          user_id: userId,
        },
      ] as never)

      if (insertError) {
        setError(`등록 실패: ${insertError.message}`)
        return
      }

      router.push('/games')
      router.refresh()
    })
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          {s.titleLabel}
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder={s.titlePlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          AI AJ 게임 설명 <span className="text-gray-600 normal-case font-sans text-[10px]">(선택 — AJ가 게임 방식을 이해하는 데 사용)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="예: 위아래 화살표로 캐릭터가 점프해서 장애물을 피하는 게임. 별을 먹으면 무적, 적에게 닿으면 죽음. 스테이지가 올라갈수록 속도가 빨라짐."
          className={inputClass + ' resize-none'}
        />
        <p className="text-[10px] text-gray-600 mt-1">{description.length}/500 — 자세할수록 AJ가 더 정확하게 중계해요</p>
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          {s.genreLabel}
        </label>
        <select
          value={genre}
          onChange={e => setGenre(e.target.value as Genre)}
          className={inputClass}
        >
          {GENRES.map(g => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          {s.urlLabel}
        </label>
        <input
          type="url"
          value={playUrl}
          onChange={e => setPlayUrl(e.target.value)}
          required
          placeholder={s.urlPlaceholder}
          className={inputClass}
        />
        <p className="text-xs text-gray-300 mt-1">{s.urlHint}</p>
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          {s.thumbnailLabel}
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
          required
          className="w-full bg-[#0d0d0d] border border-gray-700 px-4 py-3 text-sm text-gray-400
            file:mr-4 file:py-1 file:px-3 file:border-0
            file:bg-[#00ff41] file:text-black file:text-[10px] file:font-pixel file:cursor-pointer
            file:hover:bg-[#00cc33] file:transition-colors"
        />
        {thumbnailFile && (
          <p className="text-xs text-gray-400 mt-1">선택됨: {thumbnailFile.name}</p>
        )}
        <p className="text-xs text-gray-300 mt-1">{s.thumbnailHint}</p>
      </div>

      {error && (
        <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#00ff41] text-black font-pixel text-[11px] py-4 hover:bg-[#00cc33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-widest"
      >
        {isPending ? s.uploading : s.submit}
      </button>
    </form>
  )
}
