'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre } from '@/lib/supabase/types'

const GENRES: { value: Genre; label: string }[] = [
  { value: 'action', label: 'ACTION' },
  { value: 'adventure', label: 'ADVENTURE' },
  { value: 'strategy', label: 'STRATEGY' },
  { value: 'sports', label: 'SPORTS' },
]

export default function GameSubmitForm({ userId }: { userId: string }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState<Genre>('action')
  const [playUrl, setPlayUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!thumbnailFile) {
      setError('썸네일을 업로드해주세요.')
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
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-600'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          TITLE
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="게임 제목을 입력하세요"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          GENRE
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
          PLAY URL
        </label>
        <input
          type="url"
          value={playUrl}
          onChange={e => setPlayUrl(e.target.value)}
          required
          placeholder="https://your-game.railway.app"
          className={inputClass}
        />
        <p className="text-xs text-gray-600 mt-1">Railway, Vercel 등 배포 URL</p>
      </div>

      <div>
        <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
          THUMBNAIL
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
          <p className="text-xs text-gray-500 mt-1">선택됨: {thumbnailFile.name}</p>
        )}
        <p className="text-xs text-gray-600 mt-1">16:9 비율 권장 (PNG, JPG, WebP)</p>
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
        {isPending ? 'UPLOADING...' : 'SUBMIT GAME'}
      </button>
    </form>
  )
}
