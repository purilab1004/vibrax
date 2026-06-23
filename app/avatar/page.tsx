// app/avatar/page.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { defaultConfig } from '@/lib/avatar/config'
import type { AvatarConfig } from '@/lib/avatar/config'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview } from '@/lib/avatar/storage'
import type { PartCategory, Selection } from '@/lib/avatar/catalog'
import CatalogPicker from '@/components/avatar/CatalogPicker'
import type { AvatarStageHandle } from '@/components/avatar/AvatarStage'

const AvatarStage = dynamic(() => import('@/components/avatar/AvatarStage'), { ssr: false })

export default function AvatarEditorPage() {
  const router = useRouter()
  const supabase = createClient()
  const stageRef = useRef<AvatarStageHandle>(null)
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<AvatarConfig>(defaultConfig)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/avatar'); return }
      setUser(user)
      const saved = await loadAvatarConfig(supabase, user.id)
      if (saved) setConfig(saved)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSel = (cat: PartCategory, variantId: string | null) =>
    setConfig((c) => ({ ...c, selection: { ...c.selection, [cat]: variantId } as Selection }))

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    let previewUrl = config.previewUrl ?? null
    const blob = await stageRef.current?.snapshot()
    if (blob) previewUrl = (await uploadPreview(supabase, user.id, blob)) ?? previewUrl
    const toSave: AvatarConfig = { ...config, previewUrl, version: 1 }
    const { error } = await saveAvatarConfig(supabase, user.id, toSave)
    setConfig(toSave)
    setSaving(false)
    setMsg(error ? { text: '저장 실패: ' + error, ok: false } : { text: '저장되었습니다.', ok: true })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-10"><p className="font-pixel text-[10px] text-gray-400 tracking-widest">LOADING...</p></div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">MY CHARACTER</h1>
      <p className="text-xs text-gray-500">나만의 아바타를 꾸미고 저장하면, 내가 만든 게임의 방송 BJ가 됩니다.</p>
      <div className="grid md:grid-cols-2 gap-4 border border-gray-800 bg-[#0d0d0d]">
        <div className="h-[460px] bg-[#050508]">
          <AvatarStage ref={stageRef} selection={config.selection} eyeColor={config.eyeColor} view="full" />
        </div>
        <div className="h-[460px] border-l border-gray-800">
          <CatalogPicker
            selection={config.selection}
            eyeColor={config.eyeColor}
            onSelect={setSel}
            onEyeColor={(hex) => setConfig((c) => ({ ...c, eyeColor: hex }))}
            onExpression={(name) => stageRef.current?.setExpression(name)}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="font-pixel text-[10px] bg-[#00ff41] text-black px-8 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest">
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
        {msg && <span className={`text-xs font-pixel tracking-widest ${msg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
