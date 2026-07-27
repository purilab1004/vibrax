'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'
import { generateThumbnail } from '@/lib/thumbnail'

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
  // 썸네일: 기본은 타이틀 기반 자동 생성, 파일을 올리면 그걸 우선 사용
  const [customFile, setCustomFile] = useState<File | null>(null)
  const [seed, setSeed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const genBlobRef = useRef<Blob | null>(null)
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

  // 타이틀/장르/시드가 바뀌면 자동 썸네일 재생성 (직접 업로드 중이면 건너뜀)
  useEffect(() => {
    if (customFile) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const blob = await generateThumbnail(title, genre, seed)
        if (cancelled) return
        genBlobRef.current = blob
        setPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      } catch (e) {
        console.error('[thumbnail]', e)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [title, genre, seed, customFile])

  const pickFile = (f: File | null) => {
    setCustomFile(f)
    if (f) {
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(f)
      })
    } else {
      setSeed(x => x + 0) // 자동 생성 useEffect가 다시 그리도록 (customFile 변경으로 트리거됨)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const blob: Blob | null = customFile ?? genBlobRef.current
    if (!blob) {
      setError(T.submit.thumbnailRequired)
      return
    }
    setError(null)
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = customFile ? (customFile.name.split('.').pop() ?? 'png') : 'png'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('thumbnails').upload(path, blob, { upsert: false })
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
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#0284c7] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#ffffff] border border-[#ebe4d6] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-[#0284c7] text-xs tracking-widest mb-1">
          {s.publishHeading}
        </h2>
        <p className="text-[#6b6152] text-xs mb-5">{s.publishDesc}</p>

        {alreadyPublished ? (
          <p className="text-[#4a4337] text-sm mb-4">{s.alreadyPublished}</p>
        ) : done ? (
          <p className="text-[#0284c7] text-sm mb-4">{s.publishDone}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
                {T.submit.titleLabel}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
                {T.submit.genreLabel}
              </label>
              <select value={genre} onChange={e => setGenre(e.target.value as Genre)} className={inputClass}>
                {GENRES.map(g => (
                  <option key={g} value={g}>{T.genres[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
                {T.submit.thumbnailLabel}
              </label>
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="thumbnail preview" className="w-full aspect-video object-cover rounded-lg border border-[#ebe4d6] mb-2" />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { pickFile(null); setSeed(x => x + 1) }}
                  className="flex-1 border border-[#ddd3bf] text-[#4a4337] text-[13px] py-2.5 hover:border-[#0284c7] hover:text-[#0284c7] transition-colors rounded-lg"
                >
                  {s.thumbAuto}
                </button>
                <label className="flex-1 border border-[#ddd3bf] text-[#4a4337] text-[13px] py-2.5 hover:border-gray-500 transition-colors rounded-lg text-center cursor-pointer">
                  {s.thumbUpload}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={e => pickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#9d9280] mt-2">{s.thumbAutoNote}</p>
            </div>
            {error && (
              <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#0284c7] text-[#241f17] font-pixel text-[11px] py-3 hover:bg-[#0369a1] transition-colors disabled:opacity-50 tracking-widest rounded-lg"
            >
              {isPending ? s.publishing : s.publishBtn}
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 border border-[#ddd3bf] text-[#6b6152] font-pixel text-[11px] py-2.5 hover:border-gray-500 transition-colors tracking-widest rounded-lg"
        >
          {s.cancel}
        </button>
      </div>
    </div>
  )
}
