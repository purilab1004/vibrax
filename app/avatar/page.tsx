// app/avatar/page.tsx
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview, serializeConfig, applyConfig } from '@/lib/avatar/storage'
import { useAvatarStore } from '@/lib/avatar/store'
import { getCharacter } from '@/lib/avatar/editor/constants'

const EditorScene = dynamic(() => import('@/lib/avatar/editor/EditorScene').then((m) => m.EditorScene), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-[#857a68] text-sm">3D 에디터 로딩 중…</div>,
})

async function snapshotCanvas(): Promise<Blob | null> {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) return null
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

export default function AvatarEditorPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // 파츠(머리·옷 등)가 전부 로드된 뒤에만 저장 허용 — 조립 전 스냅샷(대머리 프리뷰) 방지
  const characterId = useAvatarStore((st) => st.characterId)
  const selection = useAvatarStore((st) => st.selection)
  const partStatus = useAvatarStore((st) => st.partStatus)
  const partsReady = getCharacter(characterId).catalog.every((c) => {
    if (!selection[c.id]) return true
    const st = partStatus[c.id]
    return st === 'loaded' || st === 'error' || st === 'missing'
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/avatar'); return }
      setUser(user)
      const saved = await loadAvatarConfig(supabase, user.id)
      if (saved) applyConfig(saved)
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!user || !partsReady) return
    setSaving(true)
    setMsg(null)
    // 렌더 프레임이 최신 조립 상태를 그린 뒤 캡처
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const blob = await snapshotCanvas()
    const previewUrl = blob ? await uploadPreview(supabase, user.id, blob) : null
    const config = serializeConfig(previewUrl)
    const { error } = await saveAvatarConfig(supabase, user.id, config)
    setSaving(false)
    setMsg(error ? { text: '저장 실패: ' + error, ok: false } : { text: '저장되었습니다.', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gray-950">
      <div className="flex items-center gap-4 px-4 h-12 shrink-0 border-b border-[#ebe4d6] bg-gray-900">
        <button
          onClick={() => router.push('/profile')}
          className="font-pixel text-[11px] text-[#6b6152] hover:text-[#241f17] tracking-widest"
        >
          ← 내정보
        </button>
        <h1 className="font-pixel text-[#2563eb] text-[11px] tracking-widest">아바타 설정</h1>
        <div className="flex-1" />
        {msg && <span className={`text-xs font-pixel tracking-widest ${msg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{msg.text}</span>}
        <button
          onClick={handleSave}
          disabled={!ready || saving || !partsReady}
          className="font-pixel text-[11px] bg-[#2563eb] text-[#241f17] px-7 py-2.5 hover:bg-[#1d4ed8] transition-colors disabled:opacity-40 tracking-widest shadow-[0_0_12px_rgba(37,99,235,0.35)]"
        >
          {saving ? '저장 중…' : !partsReady ? '아바타 로딩 중…' : '💾 저장하기'}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {ready ? <EditorScene /> : <div className="flex-1 h-full flex items-center justify-center text-[#857a68] text-sm">불러오는 중…</div>}
      </div>
    </div>
  )
}
