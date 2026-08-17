// app/avatar/page.tsx — 점토(jeumto) 아바타 에디터. 만든 캐릭터를 내 프로필/게임 BJ 아바타로 저장한다.
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { AvatarConfig, Gender, JeumtoCharacterData } from '@/lib/jeumto/config'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview, uploadCharacterData, fetchCharacterData } from '@/lib/jeumto/storage'
import { EDITOR_HTML } from '@/lib/jeumto/markup.js'
import '@/lib/jeumto/editor.css'

interface EditorApi {
  character: { serialize(): JeumtoCharacterData; name: string }
  newCharacter(): void
  setHasSaved(v: boolean): void
  snapshot(size?: number, opts?: { blink?: boolean }): HTMLCanvasElement
  loadCharacterData(data: JeumtoCharacterData): void
  setName(n: string): void
  toast(msg: string): void
  dispose(): void
}

export default function AvatarEditorPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<EditorApi | null>(null)
  const savedRef = useRef<AvatarConfig | null>(null)
  const savedDataRef = useRef<JeumtoCharacterData | null>(null) // 마지막 저장본(되돌리기용)
  const [hasSaved, setHasSaved] = useState(false)
  const revertRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let disposed = false
    let api: EditorApi | null = null
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/avatar'); return }
      if (disposed) return
      setUser(user)
      const root = rootRef.current
      if (!root) return
      root.innerHTML = EDITOR_HTML
      const { createJeumtoEditor } = await import('@/lib/jeumto/editor.js')
      if (disposed) return
      api = createJeumtoEditor(root, { onDirty: () => setDirty(true), onRevert: () => revertRef.current?.() }) as unknown as EditorApi
      apiRef.current = api
      const saved = await loadAvatarConfig(supabase, user.id)
      if (disposed) return
      savedRef.current = saved
      const voiceSel = root.querySelector<HTMLSelectElement>('#voice')
      if (saved) {
        if (voiceSel) voiceSel.value = saved.voice
        if (saved.dataUrl) {
          const data = await fetchCharacterData(saved.dataUrl)
          if (disposed) return
          if (data) {
            savedDataRef.current = data; setHasSaved(true); api.setHasSaved(true)
            try { api.loadCharacterData(data) } catch (e) { console.error('[avatar] load failed', e) }
          }
        }
      }
      setDirty(false)
      setReady(true)
    })()
    return () => { disposed = true; api?.dispose(); apiRef.current = null; if (rootRef.current) rootRef.current.innerHTML = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 저장 안 한 변경이 있으면 이탈 경고
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const handleSave = async () => {
    const api = apiRef.current
    if (!user || !api || saving) return
    setSaving(true)
    setMsg(null)
    try {
      const data = api.character.serialize()
      const voice: Gender = rootRef.current?.querySelector<HTMLSelectElement>('#voice')?.value === 'male' ? 'male' : 'female'
      const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob((b) => r(b), 'image/png'))
      const blob = await toBlob(api.snapshot(512))
      const blinkBlob = await toBlob(api.snapshot(512, { blink: true }))
      const [previewUrl, blinkUrl, up] = await Promise.all([
        blob ? uploadPreview(supabase, user.id, blob) : Promise.resolve(null),
        blinkBlob ? uploadPreview(supabase, user.id, blinkBlob, 'blink') : Promise.resolve(null),
        uploadCharacterData(supabase, user.id, data),
      ])
      if (!up.url) throw new Error(up.error ?? '캐릭터 업로드 실패')
      const config: AvatarConfig = {
        format: 'jeumto', version: 1,
        name: (api.character.name || '내 점토').slice(0, 24),
        voice,
        previewUrl: previewUrl ?? savedRef.current?.previewUrl ?? null,
        blinkUrl: blinkUrl ?? null,
        dataUrl: up.url,
        previewVersion: 4,
      }
      const { error } = await saveAvatarConfig(supabase, user.id, config)
      if (error) throw new Error(error)
      savedRef.current = config
      savedDataRef.current = data; setHasSaved(true); api.setHasSaved(true)
      setDirty(false)
      setMsg({ text: '저장되었습니다.', ok: true })
      api.toast(`'${config.name}' 저장했어요`)
    } catch (e) {
      setMsg({ text: '저장 실패: ' + (e instanceof Error ? e.message : String(e)), ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const revertToSaved = () => {
    const api = apiRef.current, data = savedDataRef.current
    if (!api || !data) return
    if (dirty && !confirm('지금 작업 중인 변경을 버리고 마지막 저장본으로 되돌릴까요?')) return
    api.loadCharacterData(data)
    setDirty(false)
    api.toast('마지막 저장본으로 되돌렸어요')
  }
  useEffect(() => { revertRef.current = revertToSaved })
  const resetToDefault = () => {
    const api = apiRef.current
    if (!api) return
    if (!confirm('처음(기본 점토)으로 되돌릴까요? 저장하지 않은 변경은 사라져요.')) return
    api.newCharacter()
    api.toast('기본 점토로 되돌렸어요')
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0c]">
      <div className="flex items-center gap-4 px-4 h-12 shrink-0 border-b border-[#26262c] bg-[#131316]">
        <button
          onClick={() => { if (dirty && !confirm('저장하지 않은 변경이 있어요. 나갈까요?')) return; router.push('/profile') }}
          className="font-pixel text-[11px] text-[#8b8b93] hover:text-[#ececec] tracking-widest"
        >
          ← 내정보
        </button>
        <h1 className="font-pixel text-[#ff7a59] text-[11px] tracking-widest">아바타 설정 · 점토</h1>
        <div className="flex-1" />
        <button
          onClick={revertToSaved}
          disabled={!ready || !hasSaved}
          title="마지막으로 저장한 상태로 되돌리기"
          className="hidden sm:inline-block font-pixel text-[10px] text-[#8b8b93] hover:text-[#ececec] disabled:opacity-30 tracking-widest px-2"
        >
          ↩ 저장본으로
        </button>
        <button
          onClick={resetToDefault}
          disabled={!ready}
          title="처음 기본 점토로 되돌리기"
          className="hidden sm:inline-block font-pixel text-[10px] text-[#8b8b93] hover:text-[#ececec] disabled:opacity-30 tracking-widest px-2 mr-2"
        >
          ⟲ 처음으로
        </button>
        {msg && <span className={`text-xs font-pixel tracking-widest ${msg.ok ? 'text-[#39d353]' : 'text-red-400'}`}>{msg.text}</span>}
        <button
          onClick={handleSave}
          disabled={!ready || saving}
          className="font-pixel text-[11px] bg-[#ff7a59] text-[#1a0f0b] px-7 py-2.5 hover:bg-[#ff8f73] transition-colors disabled:opacity-40 tracking-widest"
        >
          {saving ? '저장 중…' : !ready ? '불러오는 중…' : dirty ? '💾 저장하기 •' : '💾 저장하기'}
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        <div ref={rootRef} className="jeumto" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-[#8b8b93] text-sm pointer-events-none">불러오는 중…</div>
        )}
      </div>
    </div>
  )
}
