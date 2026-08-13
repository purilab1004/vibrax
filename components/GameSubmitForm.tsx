'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Genre } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
]

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
  const [language, setLanguage] = useState('ko')
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [playUrl, setPlayUrl] = useState('')
  const [coinCost, setCoinCost] = useState(1)
  const [teaserInput, setTeaserInput] = useState('')
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

      let gameManual: string | null = null
      if (manualFile) {
        gameManual = await manualFile.text()
      }

      // 카드 앞면 훅 문구 — 직접 입력 우선, AI가 한/영 생성
      let teaser: string | null = teaserInput.trim() || null
      let teaserEn: string | null = null
      try {
        const r = await fetch('/api/teaser', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, description, genre }),
        })
        if (r.ok) {
          const j = await r.json()
          if (!teaser) teaser = j.teaser ?? null
          teaserEn = j.teaserEn ?? null
        }
      } catch {}

      const row = {
        title,
        genre,
        description: description.trim() || null,
        language,
        game_manual: gameManual,
        play_url: playUrl,
        thumbnail_url: publicUrl,
        user_id: userId,
        coin_cost: Math.max(1, Math.min(100, coinCost)),
        teaser,
        teaser_en: teaserEn,
      }
      let { data: inserted, error: insertError } = await supabase.from('games').insert([row] as never).select('id').single()
      // teaser 컬럼 마이그레이션 전 — 없이 재시도
      if (insertError?.message.includes('teaser')) {
        const { teaser: _omit, teaser_en: _omit2, ...rest } = row
        ;({ data: inserted, error: insertError } = await supabase.from('games').insert([rest] as never).select('id').single())
      }

      if (insertError) {
        setError(`등록 실패: ${insertError.message}`)
        return
      }

      // 게임 출시 소개 블로그 글 자동 생성 (fire-and-forget)
      const newId = (inserted as { id: string } | null)?.id
      if (newId) {
        fetch('/api/blog/game-post', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameId: newId }),
        }).catch(() => {})
      }

      router.push('/games')
      router.refresh()
    })
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
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
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          게임 언어
        </label>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className={inputClass}
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          AI AJ 게임 설명 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(선택 — AJ가 게임 방식을 이해하는 데 사용)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="예: 위아래 화살표로 캐릭터가 점프해서 장애물을 피하는 게임. 별을 먹으면 무적, 적에게 닿으면 죽음. 스테이지가 올라갈수록 속도가 빨라짐."
          className={inputClass + ' resize-none'}
        />
        <p className="text-[11px] text-[#9d9280] mt-1">{description.length}/500 — 자세할수록 AJ가 더 정확하게 중계해요</p>
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          게임 메뉴얼 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(선택 — .md 파일 / 실행 방식·진행 방식 설명)</span>
        </label>
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          onChange={e => setManualFile(e.target.files?.[0] ?? null)}
          className="w-full bg-[#ffffff] border border-[#ddd3bf] px-4 py-3 text-sm text-[#6b6152]
            file:mr-4 file:py-1 file:px-3 file:border-0
            file:bg-gray-700 file:text-[#241f17] file:text-[11px] file:font-pixel file:cursor-pointer
            file:hover:bg-gray-600 file:transition-colors"
        />
        {manualFile && (
          <p className="text-xs text-[#6b6152] mt-1">선택됨: {manualFile.name}</p>
        )}
        <p className="text-[11px] text-[#9d9280] mt-1">AJ가 이 파일을 읽고 게임 진행 방식을 이해해 더 정확하게 방송합니다</p>
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
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
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
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
        <p className="text-xs text-[#4a4337] mt-1">{s.urlHint}</p>
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          카드 훅 문구 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(선택 — 카드 앞면에 표시, 비워두면 AI가 자동 생성)</span>
        </label>
        <input
          type="text"
          maxLength={40}
          value={teaserInput}
          onChange={e => setTeaserInput(e.target.value)}
          placeholder="예: 멈추면 죽는다 / 왕좌를 뺏어라 / 10초 버틸 수 있어?"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          🪙 플레이 비용 (VCOIN)
        </label>
        <input
          type="number"
          min={1}
          max={100}
          value={coinCost}
          onChange={e => setCoinCost(Number(e.target.value) || 1)}
          required
          className={inputClass}
        />
        <p className="text-xs text-[#4a4337] mt-1">플레이어가 이 게임을 1회 플레이할 때 지불하는 vcoin 수 (1~100, 기본 1)</p>
      </div>

      <div>
        <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
          {s.thumbnailLabel}
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)}
          required
          className="w-full bg-[#ffffff] border border-[#ddd3bf] px-4 py-3 text-sm text-[#6b6152]
            file:mr-4 file:py-1 file:px-3 file:border-0
            file:bg-[#2563eb] file:text-white file:text-[11px] file:font-pixel file:cursor-pointer
            file:hover:bg-[#1d4ed8] file:transition-colors"
        />
        {thumbnailFile && (
          <p className="text-xs text-[#6b6152] mt-1">선택됨: {thumbnailFile.name}</p>
        )}
        <p className="text-xs text-[#4a4337] mt-1">{s.thumbnailHint}</p>
      </div>

      {error && (
        <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#2563eb] text-white font-pixel text-[11px] py-4 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-widest"
      >
        {isPending ? s.uploading : s.submit}
      </button>
    </form>
  )
}
