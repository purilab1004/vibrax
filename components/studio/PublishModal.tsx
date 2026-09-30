'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { suggestIntro } from '@/lib/intro'
import { PlayModeIcon } from '@/components/PlayModeBadge'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre } from '@/lib/supabase/types'
import { generateThumbnail } from '@/lib/thumbnail'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports', 'arcade']

export default function PublishModal({
  projectId, defaultTitle, versionId, onClose,
}: {
  versionId?: string | null   // 게시할 버전 (없으면 최신)
  projectId: string
  defaultTitle: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [intro, setIntro] = useState('') // 한 줄 소개 — 비우면 게임 매니페스트 goal 로 자동
  const [introBusy, setIntroBusy] = useState(false)
  const [playMode, setPlayMode] = useState<'single' | 'multi'>('single') // 싱글/멀티 — 게임 코드에 VIBREX_NET 이 있으면 멀티로 자동 제안
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

  // 한 줄 소개 자동 — 게시할 버전 HTML 의 매니페스트 goal 에서 (LLM 없이)
  const autoIntro = async (): Promise<string> => {
    try {
      let q = supabase.from('studio_versions').select('html').eq('project_id', projectId)
      q = versionId ? q.eq('id', versionId) : q.order('version', { ascending: false }).limit(1)
      const { data } = await q.maybeSingle()
      return suggestIntro({ html: (data as { html?: string } | null)?.html, title })
    } catch { return suggestIntro({ title }) }
  }
  useEffect(() => {
    let q = supabase.from('studio_versions').select('html').eq('project_id', projectId)
    q = versionId ? q.eq('id', versionId) : q.order('version', { ascending: false }).limit(1)
    Promise.resolve(q.maybeSingle()).then(({ data }) => { const html = (data as { html?: string } | null)?.html ?? ''; if (/VIBREX_NET\.(join|hello|send)|vibrexNet|onlineRoom/.test(html)) setPlayMode('multi') }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, versionId])
  const fillIntro = async () => { setIntroBusy(true); try { setIntro(await autoIntro()) } finally { setIntroBusy(false) } }
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
      // 카드 앞면 훅 문구 — 프로젝트에 저장한 질문 우선, 없으면 AI가 한/영 생성
      let teaser: string | null = null
      let teaserEn: string | null = null
      const { data: projRow, error: projErr } = await supabase
        .from('studio_projects').select('teaser').eq('id', projectId).maybeSingle()
      if (!projErr) teaser = (projRow as { teaser?: string | null } | null)?.teaser ?? null
      if (!teaser) try {
        const r = await fetch('/api/teaser', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, genre }),
        })
        if (r.ok) {
          const j = await r.json()
          teaser = j.teaser ?? null
          teaserEn = j.teaserEn ?? null
        }
      } catch {}
      const row = {
        title,
        genre,
        play_url: `${window.location.origin}/play/${projectId}`,
        thumbnail_url: publicUrl,
        user_id: user.id,
        studio_project_id: projectId,
        teaser,
        teaser_en: teaserEn,
        intro: (intro.trim() || (await autoIntro())) || null,
        play_mode: playMode,
        ...(versionId ? { live_version_id: versionId } : {}),   // 게시 버전 고정 — 이후 수정은 '최신 버전 게시' 로만 반영
      }
      let { data: inserted, error: insertError } = await supabase.from('games').insert([row] as never).select('id').single()
      // teaser 컬럼 마이그레이션 전 — 없이 재시도
      if (insertError?.message.includes('play_mode')) {
        const { play_mode: _omitP, ...rest } = row
        ;({ data: inserted, error: insertError } = await supabase.from('games').insert([rest] as never).select('id').single())
      }
      if (insertError?.message.includes('intro')) {
        const { intro: _omitI, play_mode: _omitP2, ...rest } = row
        ;({ data: inserted, error: insertError } = await supabase.from('games').insert([rest] as never).select('id').single())
      }
      if (insertError?.message.includes('teaser')) {
        const { teaser: _omit, teaser_en: _omit2, ...rest } = row
        ;({ data: inserted, error: insertError } = await supabase.from('games').insert([rest] as never).select('id').single())
      }
      if (insertError) {
        // 23505 = 다른 탭/요청이 먼저 게시함 (games_studio_project_unique)
        if (insertError.code === '23505') setAlreadyPublished(true)
        else setError(insertError.message)
        return
      }
      // STORY 연재 시작 — 1화 자동 생성 (fire-and-forget)
      const newId = (inserted as { id: string } | null)?.id
      if (newId) {
        // 스팸 심사 (AI) — 스팸 판정 시 즉시 삭제되고 안내
        const screen = await fetch('/api/games/screen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: newId }) }).then(r => r.json()).catch(() => null) as { removed?: boolean } | null
        if (screen?.removed) { setError('운영 정책(스팸·도박·성인·외부 유도)에 맞지 않아 등록이 취소되었어요. 내용을 수정해 다시 등록해 주세요.'); return }
        fetch('/api/geo/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'publish', ref: newId }), keepalive: true }).catch(() => {})
        fetch('/api/story/game-post', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameId: newId }),
        }).catch(() => {})
      }
      setDone(true)
    })
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#ffffff] border border-[#ebe4d6] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-[#2563eb] text-xs tracking-widest mb-1">
          {s.publishHeading}
        </h2>
        <p className="text-[#6b6152] text-xs mb-5">{s.publishDesc}</p>

        {alreadyPublished ? (
          <p className="text-[#4a4337] text-sm mb-4">{s.alreadyPublished}</p>
        ) : done ? (
          <p className="text-[#2563eb] text-sm mb-4">{s.publishDone}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">
                {T.submit.titleLabel}
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">한 줄 소개 <span className="normal-case tracking-normal font-sans text-[10.5px] text-[#9d9280]">(쇼츠 카드·게임 페이지에 표시, 비우면 자동)</span></label>
              <div className="flex gap-2">
                <input value={intro} onChange={e => setIntro(e.target.value)} maxLength={80} placeholder="예: 장애물을 피해 최대한 멀리 달려라!" className={inputClass} />
                <button type="button" onClick={fillIntro} disabled={introBusy} className="shrink-0 px-3 rounded-lg border border-[#ddd3bf] text-[12px] font-semibold text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-50">{introBusy ? '…' : '✨ 자동'}</button>
              </div>
            </div>
            <div>
              <label className="block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest">플레이 방식</label>
              <div className="grid grid-cols-2 gap-2">
                {(['single', 'multi'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setPlayMode(m)} className={`h-10 rounded-lg border text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${playMode === m ? 'border-[#2563eb] bg-[#2563eb]/8 text-[#2563eb]' : 'border-[#ddd3bf] text-[#6b6152] hover:border-[#241f17]'}`}>
                    <PlayModeIcon mode={m} className="w-4 h-4" />{m === 'single' ? '싱글플레이' : '멀티플레이'}
                  </button>
                ))}
              </div>
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
                  className="flex-1 border border-[#ddd3bf] text-[#4a4337] text-[13px] py-2.5 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors rounded-lg"
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
              className="w-full bg-[#2563eb] text-white font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest rounded-lg"
            >
              {isPending ? s.publishing : s.publishBtn}
            </button>
          </form>
        )}

        {/* 게시가 끝났거나 이미 게시된 게임이면 '취소'가 아니라 '닫기' */}
        <button
          onClick={onClose}
          className="w-full mt-3 border border-[#ddd3bf] text-[#6b6152] font-pixel text-[11px] py-2.5 hover:border-gray-500 transition-colors tracking-widest rounded-lg"
        >
          {done || alreadyPublished ? s.close : s.cancel}
        </button>
      </div>
    </div>
  )
}
