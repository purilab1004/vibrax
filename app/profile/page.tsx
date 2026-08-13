'use client'

import { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Game, Genre } from '@/lib/supabase/types'
import { loadAvatarConfig } from '@/lib/avatar/storage'
import type { AvatarConfig } from '@/lib/avatar/config'

const AvatarMiniView = dynamic(() => import('@/lib/avatar/companion/AvatarMiniView'), { ssr: false })

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
]

const COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: 'KR', flag: '🇰🇷', name: '대한민국' },
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'TW', flag: '🇹🇼', name: 'Taiwan' },
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: 'TR', flag: '🇹🇷', name: 'Türkiye' },
  { code: 'RU', flag: '🇷🇺', name: 'Russia' },
]

const GENRES: { value: Genre; label: string }[] = [
  { value: 'action', label: 'ACTION' },
  { value: 'adventure', label: 'ADVENTURE' },
  { value: 'strategy', label: 'STRATEGY' },
  { value: 'sports', label: 'SPORTS' },
]

const GENRE_COLORS: Record<Genre, string> = {
  action: 'bg-red-700',
  adventure: 'bg-amber-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

interface EditingGame {
  id: string
  title: string
  genre: Genre
  description: string
  language: string
  game_manual: string
  play_url: string
  thumbnail_url: string
  teaser: string
  newThumbnail?: File | null
  newManual?: File | null
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [editingGame, setEditingGame] = useState<EditingGame | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [gameMsg, setGameMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [country, setCountry] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentPersona, setAgentPersona] = useState('')
  const [agentAvatarUrl, setAgentAvatarUrl] = useState('')
  const [agentAvatarFile, setAgentAvatarFile] = useState<File | null>(null)
  const [agentMsg, setAgentMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [myAvatarConfig, setMyAvatarConfig] = useState<AvatarConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/profile'); return }
      setUser(user)
      loadProfile(user.id)
      loadGames(user.id)
      loadAvatarConfig(supabase, user.id).then(setMyAvatarConfig).catch(() => {})
      setCountry(user.user_metadata?.country ?? '')
      setAgentName(user.user_metadata?.agent_name ?? '')
      setAgentPersona(user.user_metadata?.agent_persona ?? '')
      setAgentAvatarUrl(user.user_metadata?.agent_avatar_url ?? '')
    })
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('username').eq('id', userId).single()
    if (data) setUsername((data as { username: string }).username)
    setLoading(false)
  }

  async function loadGames(userId: string) {
    const { data } = await supabase.from('games').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setGames((data as Game[]) ?? [])
  }

  const flash = (setter: (v: { text: string; ok: boolean } | null) => void, text: string, ok: boolean) => {
    setter({ text, ok })
    setTimeout(() => setter(null), 3000)
  }

  const handleSaveUsername = () => {
    if (!user || !newUsername.trim()) return
    startTransition(async () => {
      const { error } = await supabase.from('profiles').update({ username: newUsername.trim() } as never).eq('id', user.id)
      if (error) { flash(setProfileMsg, '저장 실패: ' + error.message, false); return }
      setUsername(newUsername.trim())
      setEditingUsername(false)
      flash(setProfileMsg, '저장되었습니다.', true)
    })
  }

  const handleChangeCountry = (code: string) => {
    setCountry(code)
    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ data: { country: code || null } })
      // 공개 표시용 — 게임 카드에서 다른 사용자가 읽도록 profiles 에도 저장
      if (user) await supabase.from('profiles').update({ country: code || null } as never).eq('id', user.id)
      flash(setProfileMsg, error ? '저장 실패: ' + error.message : '국가가 저장되었습니다.', !error)
    })
  }

  const handleChangePassword = () => {
    if (newPassword.length < 6) { flash(setPwMsg, '비밀번호는 최소 6자리입니다.', false); return }
    if (newPassword !== confirmPassword) { flash(setPwMsg, '비밀번호가 일치하지 않습니다.', false); return }
    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { flash(setPwMsg, '변경 실패: ' + error.message, false); return }
      setNewPassword('')
      setConfirmPassword('')
      flash(setPwMsg, '비밀번호가 변경되었습니다.', true)
    })
  }

  const handleSaveAgent = () => {
    startTransition(async () => {
      let avatarUrl = agentAvatarUrl

      if (agentAvatarFile && user) {
        const ext = agentAvatarFile.name.split('.').pop() ?? 'png'
        const path = `agent-avatars/${user.id}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, agentAvatarFile, { upsert: true })
        if (uploadErr) { flash(setAgentMsg, '이미지 업로드 실패: ' + uploadErr.message, false); return }
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = publicUrl
        setAgentAvatarUrl(publicUrl)
        setAgentAvatarFile(null)
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          agent_name: agentName.trim(),
          agent_persona: agentPersona.trim(),
          agent_avatar_url: avatarUrl || null,
        },
      })
      if (error) { flash(setAgentMsg, '저장 실패: ' + error.message, false); return }
      // 공개 표시명 — 다른 사용자가 게임 카드에서 읽을 수 있도록 profiles 에도 저장
      if (user) {
        await supabase.from('profiles').update({ agent_name: agentName.trim() || null } as never).eq('id', user.id)
      }
      flash(setAgentMsg, '에이전트가 저장되었습니다.', true)
    })
  }

  const handleSaveGame = () => {
    if (!editingGame || !user) return
    startTransition(async () => {
      let thumbnailUrl = editingGame.thumbnail_url

      if (editingGame.newThumbnail) {
        const file = editingGame.newThumbnail
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('thumbnails').upload(path, file, { upsert: false })
        if (uploadErr) { flash(setGameMsg, '썸네일 업로드 실패: ' + uploadErr.message, false); return }
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
        thumbnailUrl = publicUrl
      }

      let gameManual = editingGame.game_manual || null
      if (editingGame.newManual) {
        gameManual = await editingGame.newManual.text()
      }

      const { error } = await supabase.from('games').update({
        title: editingGame.title,
        genre: editingGame.genre,
        description: editingGame.description.trim() || null,
        language: editingGame.language || null,
        game_manual: gameManual,
        play_url: editingGame.play_url,
        thumbnail_url: thumbnailUrl,
        teaser: editingGame.teaser.trim() || null,
      } as never).eq('id', editingGame.id)

      if (error) { flash(setGameMsg, '저장 실패: ' + error.message, false); return }
      setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, title: editingGame.title, genre: editingGame.genre, description: editingGame.description.trim() || null, language: editingGame.language || null, game_manual: gameManual, play_url: editingGame.play_url, thumbnail_url: thumbnailUrl, teaser: editingGame.teaser.trim() || null } : g))
      setEditingGame(null)
      flash(setGameMsg, '수정되었습니다.', true)
    })
  }

  const handleDeleteGame = (gameId: string) => {
    startTransition(async () => {
      const { error } = await supabase.from('games').delete().eq('id', gameId)
      if (error) { flash(setGameMsg, '삭제 실패: ' + error.message, false); return }
      setGames(prev => prev.filter(g => g.id !== gameId))
      setDeleteConfirm(null)
      flash(setGameMsg, '삭제되었습니다.', true)
    })
  }

  const inputClass = 'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-2.5 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">LOADING...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
      <h1 className="font-pixel text-[#2563eb] text-sm tracking-widest">MY PAGE</h1>

      {/* ── Profile ── */}
      <section id="profile" className="scroll-mt-20 border border-[#ebe4d6] bg-[#ffffff] p-6 space-y-6">
        <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">PROFILE</h2>

        {/* Email */}
        <div>
          <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-1">EMAIL</p>
          <p className="text-sm text-[#4a4337]">{user?.email}</p>
        </div>

        {/* Username */}
        <div>
          <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">USERNAME</p>
          {editingUsername ? (
            <div className="flex items-center gap-3 flex-wrap">
              <input className={inputClass + ' max-w-xs'} value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus />
              <button onClick={handleSaveUsername} disabled={isPending} className="font-pixel text-[11px] bg-[#2563eb] text-white px-4 py-2 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest">SAVE</button>
              <button onClick={() => { setEditingUsername(false); setNewUsername('') }} className="font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] px-4 py-2 hover:border-gray-500 transition-colors tracking-widest">CANCEL</button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#241f17]">{username}</span>
              <button onClick={() => { setEditingUsername(true); setNewUsername(username) }} className="font-pixel text-[11px] text-[#857a68] hover:text-[#2563eb] transition-colors border border-[#ebe4d6] hover:border-[#2563eb] px-3 py-1 tracking-widest">EDIT</button>
            </div>
          )}
        </div>

        {/* Country */}
        <div>
          <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">COUNTRY</p>
          <select
            value={country}
            onChange={e => handleChangeCountry(e.target.value)}
            disabled={isPending}
            className={inputClass + ' max-w-xs cursor-pointer disabled:opacity-50'}
          >
            <option value="">선택 안 함</option>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>

        {profileMsg && <p className={`text-xs font-pixel tracking-widest ${profileMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{profileMsg.text}</p>}
      </section>

      {/* ── Password ── */}
      <section id="password" className="scroll-mt-20 border border-[#ebe4d6] bg-[#ffffff] p-6 space-y-4">
        <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">CHANGE PASSWORD</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">NEW PASSWORD</p>
            <input type="password" className={inputClass} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="최소 6자리" />
          </div>
          <div>
            <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">CONFIRM PASSWORD</p>
            <input type="password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" />
          </div>
        </div>
        {pwMsg && <p className={`text-xs font-pixel tracking-widest ${pwMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{pwMsg.text}</p>}
        <button onClick={handleChangePassword} disabled={isPending || !newPassword || !confirmPassword} className="font-pixel text-[11px] bg-[#2563eb] text-white px-6 py-2.5 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest">
          CHANGE PASSWORD
        </button>
      </section>

      {/* ── My Agent ── */}
      <section id="agent" className="scroll-mt-20 border border-[#ebe4d6] bg-[#ffffff] p-6 space-y-5">
        <div>
          <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">MY AGENT</h2>
          <p className="text-xs text-[#857a68] mt-1.5 leading-relaxed">
            게임을 플레이하는 동안 <span className="text-purple-400">나 대신 AI 스트리머 AJ와 실시간으로 대화</span>해주는 나만의 AI 에이전트예요.<br />
            당신이 게임에 집중하는 사이, 에이전트가 AJ와 채팅하며 방송의 흥을 이어가줍니다.
          </p>
          <div className="mt-3 border border-purple-900/40 bg-purple-900/10 px-4 py-3 space-y-1">
            <p className="font-pixel text-[10px] text-purple-400 tracking-widest">AGENT란?</p>
            <p className="text-[11px] text-[#6b6152] leading-relaxed">• 이름과 성격을 부여하면 그대로 행동하는 AI</p>
            <p className="text-[11px] text-[#6b6152] leading-relaxed">• 게임 방송 중 18초마다 AJ에게 말을 걸어줌</p>
            <p className="text-[11px] text-[#6b6152] leading-relaxed">• 게임 진입 시 AGENT 설정이 필요해요</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* ── Col 1: 에이전트 설정 ── */}
          <div className="space-y-5">
            {/* Avatar */}
            <div>
              <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">에이전트 프로필 사진</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border border-dashed border-[#ddd3bf] overflow-hidden bg-gray-900/50 shrink-0 flex items-center justify-center">
                  {(agentAvatarFile ? URL.createObjectURL(agentAvatarFile) : agentAvatarUrl) ? (
                    <Image
                      src={agentAvatarFile ? URL.createObjectURL(agentAvatarFile) : agentAvatarUrl}
                      alt="agent avatar"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="font-pixel text-[10px] text-[#9d9280] tracking-widest">사진</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={e => setAgentAvatarFile(e.target.files?.[0] ?? null)}
                    className="w-full bg-[#ffffff] border border-[#ddd3bf] px-3 py-2 text-xs text-[#6b6152]
                      file:mr-3 file:py-1 file:px-3 file:border-0
                      file:bg-purple-800 file:text-white file:text-[11px] file:font-pixel file:cursor-pointer
                      file:hover:bg-purple-700 file:transition-colors"
                  />
                  {agentAvatarFile && <p className="text-[11px] text-[#857a68] mt-1">{agentAvatarFile.name}</p>}
                </div>
              </div>
            </div>

            <div>
              <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">에이전트 이름</p>
              <input
                className={inputClass}
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                placeholder="예: 도라에몽, 철수, ..."
                maxLength={20}
              />
            </div>
            <div>
              <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest mb-2">성격 / 말투</p>
              <textarea
                className={inputClass + ' resize-none'}
                rows={3}
                value={agentPersona}
                onChange={e => setAgentPersona(e.target.value)}
                placeholder="예: 항상 긍정적이고 열정적인 게이머. 재밌으면 크게 리액션함."
                maxLength={100}
              />
              <p className="text-[11px] text-[#9d9280] mt-1">{agentPersona.length}/100</p>
            </div>
            {agentMsg && <p className={`text-xs font-pixel tracking-widest ${agentMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{agentMsg.text}</p>}
            <button
              onClick={handleSaveAgent}
              disabled={isPending || (!agentName.trim() && !agentPersona.trim())}
              className="font-pixel text-[11px] bg-[#2563eb] text-white px-6 py-2.5 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest"
            >
              {isPending ? 'SAVING...' : 'SAVE AGENT'}
            </button>
            {agentName.trim() && (
              <div className="border border-purple-800/40 bg-purple-900/10 px-4 py-3 flex items-center gap-3">
                {agentAvatarUrl && (
                  <div className="w-8 h-8 rounded-full border border-purple-700/50 overflow-hidden bg-gray-900 shrink-0">
                    <Image src={agentAvatarUrl} alt={agentName} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                  </div>
                )}
                <span className="font-pixel text-[11px] text-purple-400 shrink-0">{agentName}</span>
                {agentPersona && <span className="text-xs text-[#857a68] truncate">{agentPersona}</span>}
              </div>
            )}
          </div>

          {/* ── Col 2: 내 아바타 (게임 방송 BJ) ── */}
          <div className="space-y-3">
            <p className="font-pixel text-[11px] text-[#9d9280] tracking-widest">MY CHARACTER · 게임 방송 BJ</p>
            <div className="relative w-full max-w-[260px] aspect-[3/4] border border-[#ebe4d6] bg-[#050508] overflow-hidden">
              {myAvatarConfig ? (
                <AvatarMiniView config={myAvatarConfig} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <span className="text-3xl">🧍</span>
                  <p className="text-[11px] text-[#857a68]">아직 저장한 아바타가 없어요</p>
                </div>
              )}
            </div>
            <a href="/avatar" className="inline-block font-pixel text-[11px] border border-[#2563eb] text-[#2563eb] px-6 py-2.5 hover:bg-[#2563eb] hover:text-white transition-colors tracking-widest">
              🎨 아바타 설정
            </a>
            <p className="text-[11px] text-[#857a68] leading-relaxed">저장한 아바타가 내가 만든 게임의 방송 BJ로 등장해요. 게임 목록엔 아이디 대신 <span className="text-purple-400">에이전트 이름</span>이 표시됩니다.</p>
          </div>
        </div>
      </section>

      {/* ── My Games ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest">MY GAMES <span className="text-[#2563eb]">({games.length})</span></h2>
          {gameMsg && <p className={`text-xs font-pixel tracking-widest ${gameMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{gameMsg.text}</p>}
        </div>

        {games.length === 0 ? (
          <div className="border border-[#ebe4d6] p-12 text-center">
            <p className="text-[#857a68] text-sm mb-4">아직 등록한 게임이 없습니다.</p>
            <a href="/submit" className="font-pixel text-[11px] text-[#2563eb] hover:underline tracking-widest">+ 첫 게임 등록하기</a>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <div key={game.id} className="border border-[#ebe4d6] bg-[#ffffff] hover:border-[#ddd3bf] transition-colors">
                <div className="flex items-center gap-4 p-4">
                  <div className="relative w-20 h-12 shrink-0 overflow-hidden bg-gray-900">
                    <Image src={game.thumbnail_url} alt={game.title} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-pixel text-[10px] px-1.5 py-0.5 text-[#241f17] ${GENRE_COLORS[game.genre]}`}>{game.genre.toUpperCase()}</span>
                      {game.language && (
                        <span className="font-pixel text-[10px] px-1.5 py-0.5 text-[#4a4337] border border-[#ddd3bf]">{game.language === 'ko' ? '한국어' : 'EN'}</span>
                      )}
                      {game.game_manual && (
                        <span className="font-pixel text-[10px] px-1.5 py-0.5 text-[#6b6152] border border-[#ebe4d6]">📄 MD</span>
                      )}
                    </div>
                    <p className="text-sm text-[#241f17] truncate font-medium">{game.title}</p>
                    <p className="text-xs text-[#857a68] truncate mt-0.5">{game.play_url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingGame({ id: game.id, title: game.title, genre: game.genre, description: game.description ?? '', language: game.language ?? 'ko', game_manual: game.game_manual ?? '', play_url: game.play_url, thumbnail_url: game.thumbnail_url, teaser: game.teaser ?? '', newThumbnail: null, newManual: null })}
                      className="font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb] px-3 py-1.5 transition-colors tracking-widest"
                    >
                      EDIT
                    </button>
                    {deleteConfirm === game.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteGame(game.id)} disabled={isPending} className="font-pixel text-[11px] bg-red-700 text-white px-3 py-1.5 hover:bg-red-600 transition-colors disabled:opacity-50 tracking-widest">확인</button>
                        <button onClick={() => setDeleteConfirm(null)} className="font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] px-3 py-1.5 tracking-widest">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(game.id)} className="font-pixel text-[11px] border border-[#ebe4d6] text-[#9d9280] hover:border-red-700 hover:text-red-400 px-3 py-1.5 transition-colors tracking-widest">DEL</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Edit Game Modal ── */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md bg-[#fcfaf5] border border-[#ddd3bf] max-h-[90svh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe4d6]">
              <p className="font-pixel text-[11px] text-[#2563eb] tracking-widest">EDIT GAME</p>
              <button onClick={() => setEditingGame(null)} className="font-pixel text-[11px] text-[#857a68] hover:text-[#241f17] transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Thumbnail preview + upload */}
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">THUMBNAIL</label>
                <div className="relative w-full aspect-video mb-3 overflow-hidden bg-gray-900 border border-[#ebe4d6]">
                  <Image
                    src={editingGame.newThumbnail ? URL.createObjectURL(editingGame.newThumbnail) : editingGame.thumbnail_url}
                    alt="thumbnail"
                    fill
                    className="object-cover"
                  />
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={e => setEditingGame(prev => prev ? { ...prev, newThumbnail: e.target.files?.[0] ?? null } : null)}
                  className="w-full bg-[#ffffff] border border-[#ddd3bf] px-4 py-2.5 text-sm text-[#6b6152]
                    file:mr-4 file:py-1 file:px-3 file:border-0
                    file:bg-[#2563eb] file:text-white file:text-[11px] file:font-pixel file:cursor-pointer
                    file:hover:bg-[#1d4ed8] file:transition-colors"
                />
                {editingGame.newThumbnail && <p className="text-xs text-[#6b6152] mt-1">선택됨: {editingGame.newThumbnail.name}</p>}
              </div>

              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">TITLE</label>
                <input className={inputClass} value={editingGame.title} onChange={e => setEditingGame(prev => prev ? { ...prev, title: e.target.value } : null)} />
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">
                  카드 훅 문구 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(카드 앞면에 표시 — 비워두면 기본 문구)</span>
                </label>
                <input
                  className={inputClass}
                  maxLength={40}
                  placeholder="예: 멈추면 죽는다 / 왕좌를 뺏어라"
                  value={editingGame.teaser}
                  onChange={e => setEditingGame(prev => prev ? { ...prev, teaser: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">게임 언어</label>
                <select className={inputClass} value={editingGame.language} onChange={e => setEditingGame(prev => prev ? { ...prev, language: e.target.value } : null)}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">AI AJ 게임 설명</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  className={inputClass + ' resize-none'}
                  value={editingGame.description}
                  onChange={e => setEditingGame(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="조작 방법, 적, 아이템, 목표 등을 설명해주세요"
                />
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">
                  게임 메뉴얼 <span className="text-[#9d9280] normal-case font-sans text-[11px]">(.md 파일)</span>
                </label>
                {editingGame.game_manual && !editingGame.newManual && (
                  <p className="text-[11px] text-[#2563eb] mb-2">✓ 메뉴얼 등록됨 — 새 파일 업로드 시 교체됩니다</p>
                )}
                <input
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  onChange={e => setEditingGame(prev => prev ? { ...prev, newManual: e.target.files?.[0] ?? null } : null)}
                  className="w-full bg-[#ffffff] border border-[#ddd3bf] px-4 py-2.5 text-sm text-[#6b6152]
                    file:mr-4 file:py-1 file:px-3 file:border-0
                    file:bg-gray-700 file:text-[#241f17] file:text-[11px] file:font-pixel file:cursor-pointer
                    file:hover:bg-gray-600 file:transition-colors"
                />
                {editingGame.newManual && <p className="text-xs text-[#6b6152] mt-1">선택됨: {editingGame.newManual.name}</p>}
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">GENRE</label>
                <select className={inputClass} value={editingGame.genre} onChange={e => setEditingGame(prev => prev ? { ...prev, genre: e.target.value as Genre } : null)}>
                  {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">PLAY URL</label>
                <input className={inputClass} value={editingGame.play_url} onChange={e => setEditingGame(prev => prev ? { ...prev, play_url: e.target.value } : null)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveGame} disabled={isPending} className="flex-1 font-pixel text-[11px] bg-[#2563eb] text-white py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest">
                  {isPending ? 'SAVING...' : 'SAVE'}
                </button>
                <button onClick={() => setEditingGame(null)} className="flex-1 font-pixel text-[11px] border border-[#ddd3bf] text-[#6b6152] py-3 hover:border-gray-500 transition-colors tracking-widest">
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
