'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

export default function PublishModal({
  projectId, defaultTitle, onClose,
}: {
  projectId: string
  defaultTitle: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [genre, setGenre] = useState<Genre>('action')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [alreadyPublished, setAlreadyPublished] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    supabase.from('games').select('id').eq('studio_project_id', projectId)
      .limit(1).maybeSingle()
      .then(({ data }) => setAlreadyPublished(!!data))
  }, [projectId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!thumbnailFile) {
      setError(T.submit.thumbnailRequired)
      return
    }
    setError(null)
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = thumbnailFile.name.split('.').pop() ?? 'png'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('thumbnails').upload(path, thumbnailFile, { upsert: false })
      if (uploadError) {
        setError(uploadError.message)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
      const { error: insertError } = await supabase.from('games').insert([
        {
          title,
          genre,
          play_url: `${window.location.origin}/play/${projectId}`,
          thumbnail_url: publicUrl,
          user_id: user.id,
          studio_project_id: projectId,
        },
      ] as never)
      if (insertError) {
        // 23505 = 다른 탭/요청이 먼저 게시함 (games_studio_project_unique)
        if (insertError.code === '23505') setAlreadyPublished(true)
        else setError(insertError.message)
        return
      }
      setDone(true)
    })
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-gray-800 p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-[#00ff41] text-xs tracking-widest mb-1">
          {s.publishHeading}
        </h2>
        <p className="text-gray-400 text-xs mb-5">{s.publishDesc}</p>

        {alreadyPublished ? (
          <p className="text-gray-300 text-sm mb-4">{s.alreadyPublished}</p>
        ) : done ? (
          <p className="text-[#00ff41] text-sm mb-4">{s.publishDone}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.titleLabel}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.genreLabel}
              </label>
              <select value={genre} onChange={e => setGenre(e.target.value as Genre)} className={inputClass}>
                {GENRES.map(g => (
                  <option key={g} value={g}>{T.genres[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-pixel text-[10px] mb-2 text-gray-400 tracking-widest">
                {T.submit.thumbnailLabel}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
                required
                className="w-full bg-[#0d0d0d] border border-gray-700 px-4 py-3 text-sm text-gray-400
                  file:mr-4 file:py-1 file:px-3 file:border-0
                  file:bg-[#00ff41] file:text-black file:text-[10px] file:font-pixel file:cursor-pointer"
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#00ff41] text-black font-pixel text-[11px] py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest"
            >
              {isPending ? s.publishing : s.publishBtn}
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 border border-gray-700 text-gray-400 font-pixel text-[10px] py-2.5 hover:border-gray-500 transition-colors tracking-widest"
        >
          {s.cancel}
        </button>
      </div>
    </div>
  )
}
