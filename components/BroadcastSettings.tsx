'use client'
// 프로필 — 방송(BJ) 설정: AJ 아바타 vs 라이브 방송(영상 링크). avatar_config.broadcast 에 저장.
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvatarConfig } from '@/lib/jeumto/config'
import { emptyConfig } from '@/lib/jeumto/config'
import { saveAvatarConfig } from '@/lib/jeumto/storage'
import { DEFAULT_BROADCAST, toEmbed, type BroadcastSetting } from '@/lib/broadcast'

interface Props {
  supabase: SupabaseClient
  userId: string
  config: AvatarConfig | null
  onSaved: (next: AvatarConfig) => void
}

export default function BroadcastSettings({ supabase, userId, config, onSaved }: Props) {
  // config 가 늦게 로드되면 (초기 null → 값) 편집 전 상태를 그 값으로 맞춘다
  const [b, setBState] = useState<BroadcastSetting>(config?.broadcast ?? DEFAULT_BROADCAST)
  const [touched, setTouched] = useState(false)
  const setB = (v: BroadcastSetting) => { setTouched(true); setBState(v) }
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const seed = config?.broadcast
  const [seenSeed, setSeenSeed] = useState(seed)
  if (seed !== seenSeed) { setSeenSeed(seed); if (!touched && seed) setBState(seed) }
  const embed = toEmbed(b.url)

  const save = async (next: BroadcastSetting) => {
    setSaving(true); setMsg(null)
    const base = config ?? emptyConfig()
    const merged: AvatarConfig = { ...base, broadcast: next }
    const { error } = await saveAvatarConfig(supabase, userId, merged)
    setSaving(false)
    if (error) { setMsg('저장 실패: ' + error); return }
    setB(next); onSaved(merged)
    setMsg(next.mode === 'live' && next.on ? '● ON AIR — 내 게임에서 영상이 나와요' : '저장했어요')
    setTimeout(() => setMsg(null), 2500)
  }

  const btn = 'font-pixel text-[11px] px-4 py-2 border tracking-widest transition-colors'
  return (
    <div className="space-y-3">
      <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest">BROADCAST · 방송 방식</p>
      <div className="flex gap-2">
        <button onClick={() => save({ ...b, mode: 'avatar' })} disabled={saving}
          className={`${btn} ${b.mode === 'avatar' ? 'bg-[#2563eb] text-white border-[#2563eb]' : 'border-[#ddd3bf] text-[#6b6152] hover:border-[#2563eb]'}`}>
          🧸 AJ 아바타
        </button>
        <button onClick={() => setB({ ...b, mode: 'live' })} disabled={saving}
          className={`${btn} ${b.mode === 'live' ? 'bg-[#e11d48] text-white border-[#e11d48]' : 'border-[#ddd3bf] text-[#6b6152] hover:border-[#e11d48]'}`}>
          📹 라이브 방송
        </button>
      </div>
      {b.mode === 'live' && (
        <div className="space-y-2 border border-[#ebe4d6] bg-white/60 p-3">
          <label className="block text-[11px] text-[#857a68]">방송 링크 (YouTube 라이브/영상, Twitch 채널)</label>
          <input
            value={b.url}
            onChange={(e) => setB({ ...b, url: e.target.value })}
            placeholder="https://youtube.com/live/… 또는 https://twitch.tv/채널"
            className="w-full bg-white border border-[#ddd3bf] focus:border-[#2563eb] px-3 py-2 text-sm outline-none text-[#241f17] placeholder-[#a1957f]"
          />
          {b.url && !embed && <p className="text-[11px] text-red-500">지원하지 않는 링크예요. YouTube/Twitch 링크를 붙여넣어 주세요.</p>}
          {embed && (
            <div className="aspect-video w-full max-w-[320px] rounded-lg overflow-hidden bg-black">
              <iframe src={embed.src} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => save({ ...b, mode: 'live', on: !b.on })}
              disabled={saving || !embed}
              className={`${btn} ${b.on ? 'bg-[#e11d48] text-white border-[#e11d48] animate-pulse' : 'border-[#e11d48] text-[#e11d48] hover:bg-[#e11d48] hover:text-white'} disabled:opacity-40`}
            >
              {b.on ? '● ON AIR (끄기)' : '○ 방송 시작 (ON AIR)'}
            </button>
            <button onClick={() => save({ ...b, mode: 'live' })} disabled={saving || !embed}
              className={`${btn} border-[#ddd3bf] text-[#6b6152] hover:border-[#2563eb] disabled:opacity-40`}>
              링크 저장
            </button>
          </div>
          <p className="text-[11px] text-[#857a68] leading-relaxed">
            ON AIR 를 켜면 내 게임을 플레이하는 사람에게 AJ 아바타 대신 이 영상이 BJ 자리에 나와요. 폰으로 YouTube 앱에서 라이브를 켜고, 그 라이브 링크(공유 → 링크 복사)를 여기에 붙여넣으면 됩니다. 끄면 다시 아바타가 말해요.
          </p>
        </div>
      )}
      {msg && <p className="text-[11px] text-[#2563eb]">{msg}</p>}
    </div>
  )
}
