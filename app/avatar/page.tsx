// app/avatar/page.tsx
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview, serializeConfig, applyConfig } from '@/lib/avatar/storage'

const EditorScene = dynamic(() => import('@/lib/avatar/editor/EditorScene').then((m) => m.EditorScene), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">3D 에디터 로딩 중…</div>,
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
  const [nickname, setNickname] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/avatar'); return }
      setUser(user)
      const saved = await loadAvatarConfig(supabase, user.id)
      if (saved) { applyConfig(saved); setNickname(saved.nickname ?? '') }
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setMsg(null)
    const blob = await snapshotCanvas()
    const previewUrl = blob ? await uploadPreview(supabase, user.id, blob) : null
    const config = serializeConfig({ previewUrl, nickname: nickname.trim() || null })
    const { error } = await saveAvatarConfig(supabase, user.id, config)
    setSaving(false)
    setMsg(error ? { text: '저장 실패: ' + error, ok: false } : { text: '저장되었습니다.', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gray-950">
      <div className="flex items-center gap-4 px-4 h-12 shrink-0 border-b border-gray-800 bg-gray-900">
        <button
          onClick={() => router.push('/profile')}
          className="font-pixel text-[10px] text-gray-400 hover:text-white tracking-widest"
        >
          ← 내정보
        </button>
        <h1 className="font-pixel text-[#00ff41] text-[11px] tracking-widest">아바타 설정</h1>
        <div className="flex items-center gap-2 ml-2">
          <label className="font-pixel text-[8px] text-gray-500 tracking-widest hidden sm:block">닉네임</label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="아바타 닉네임"
            maxLength={20}
            className="w-40 bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
          />
        </div>
        <div className="flex-1" />
        {msg && <span className={`text-xs font-pixel tracking-widest ${msg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{msg.text}</span>}
        <button
          onClick={handleSave}
          disabled={!ready || saving}
          className="font-pixel text-[11px] bg-[#00ff41] text-black px-7 py-2.5 hover:bg-[#00cc33] transition-colors disabled:opacity-40 tracking-widest shadow-[0_0_12px_rgba(0,255,65,0.35)]"
        >
          {saving ? '저장 중…' : '💾 저장하기'}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {ready ? <EditorScene /> : <div className="flex-1 h-full flex items-center justify-center text-gray-500 text-sm">불러오는 중…</div>}
      </div>
    </div>
  )
}
