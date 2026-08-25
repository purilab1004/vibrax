'use client'

import NoticesSection from '@/components/profile/NoticesSection'
import AiLearningSection from '@/components/profile/AiLearningSection'
import GameCurriculumModal from '@/components/profile/GameCurriculumModal'
import { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { COUNTRIES } from '@/lib/countries'
import { GameCoinBadge, PromptCreditBadge } from '@/components/CurrencyBadge'
import type { Game, Genre } from '@/lib/supabase/types'
import { loadAvatarConfig, saveAvatarConfig, uploadPreview } from '@/lib/jeumto/storage'
import { liveInfoOf } from '@/lib/broadcast'
import MyCollections from '@/components/MyCollections'
import type { AvatarConfig } from '@/lib/jeumto/config'

const JeumtoView = dynamic(() => import('@/lib/jeumto/JeumtoView'), { ssr: false })

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

const GENRE_COLORS: Record<Genre, string> = {
  action: 'bg-[#e11d48]',
  adventure: 'bg-[#059669]',
  strategy: 'bg-[#7c3aed]',
  sports: 'bg-[#f59e0b]',
}

interface EditingGame {
  id: string
  title: string
  genre: Genre
  description: string
  language: string
  country: string
  game_manual: string
  play_url: string
  thumbnail_url: string
  teaser: string
  newThumbnail?: File | null
  newManual?: File | null
}

type Tab = 'profile' | 'password' | 'agent' | 'learning' | 'games' | 'collections' | 'billing' | 'notices'
const TAB_LABEL: Record<Tab, string> = { profile: '프로필', password: '비밀번호', agent: 'AJ 외모', learning: 'AJ 학습', games: '내 게임', collections: '좋아요·컬렉션', billing: '결제 내역', notices: '공지사항' }
const tabFromHash = (): Tab => { const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''; return (['profile', 'password', 'agent', 'learning', 'games', 'collections', 'billing', 'notices'] as Tab[]).includes(h as Tab) ? (h as Tab) : 'profile' }

export default function ProfilePage() {
  // 사이드 메뉴 탭 — 해시(#games 등)에 따라 해당 섹션만 표시 (스크롤 아님)
  const [tab, setTab] = useState<Tab>('profile')
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [vcoinBalance, setVcoinBalance] = useState<number | null>(null)
  useEffect(() => {
    const sync = () => setTab(tabFromHash())
    sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync)
  }, [])
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [editingGame, setEditingGame] = useState<EditingGame | null>(null)
  const [curriculumGame, setCurriculumGame] = useState<{ id: string; title: string } | null>(null)
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
  const [onAirGames, setOnAirGames] = useState<Game[]>([])
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
      loadAvatarConfig(supabase, user.id).then(async (cfg) => {
        setMyAvatarConfig(cfg)
        // 방송 중이면 추천 게임을 MY GAMES 맨 위에 ON AIR 로 보여준다 (내 게임이 아니어도)
        const ids = new Set<string>()
        if (cfg && liveInfoOf(cfg.broadcast, user.id) && cfg.broadcast?.gameId) ids.add(cfg.broadcast.gameId)
        for (const l of cfg?.broadcasts ?? []) if (l.on && l.gameId) ids.add(l.gameId)
        if (ids.size) {
          const { data } = await supabase.from('games').select('*').in('id', [...ids])
          setOnAirGames((data as Game[]) ?? [])
        } else setOnAirGames([])
      }).catch(() => {})
      setCountry(user.user_metadata?.country ?? '')
      setAgentName(user.user_metadata?.agent_name ?? '')
      setAgentPersona(user.user_metadata?.agent_persona ?? '')
      setAgentAvatarUrl(user.user_metadata?.agent_avatar_url ?? '')
    })
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('username, vcoin').eq('id', userId).single()
    if (data) { setUsername((data as { username: string }).username); setVcoinBalance((data as { vcoin?: number }).vcoin ?? null) }
    supabase.rpc('credit_balance' as never).then(({ data: b }) => setCreditBalance(typeof b === 'number' ? b : 0))
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
        country: editingGame.country || null,
        game_manual: gameManual,
        play_url: editingGame.play_url,
        thumbnail_url: thumbnailUrl,
        teaser: editingGame.teaser.trim() || null,
      } as never).eq('id', editingGame.id)

      if (error) { flash(setGameMsg, '저장 실패: ' + error.message, false); return }
      setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, title: editingGame.title, genre: editingGame.genre, description: editingGame.description.trim() || null, language: editingGame.language || null, country: editingGame.country || null, game_manual: gameManual, play_url: editingGame.play_url, thumbnail_url: thumbnailUrl, teaser: editingGame.teaser.trim() || null } : g))
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

  const inputClass = 'w-full h-10 rounded-lg bg-white border border-[#ddd3bf] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 px-3.5 text-[14px] outline-none transition text-[#241f17] placeholder-[#a1957f]'

  if (loading) return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <p className="font-pixel text-[11px] text-[#6b6152] tracking-widest">LOADING...</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* 헤더 — 프로필 탭에서만 노출 */}
      {tab === 'profile' && (
      <div className="relative overflow-hidden rounded-3xl bg-[#171b26] text-white shadow-[0_24px_60px_-28px_rgba(23,27,38,0.6)]">
        <div aria-hidden className="absolute inset-0 pointer-events-none"><div className="absolute -top-24 -left-10 w-72 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.55),transparent)] blur-2xl" /><div className="absolute -bottom-28 right-10 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.35),transparent)] blur-2xl" /><div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} /></div>
        <div className="relative px-6 md:px-8 py-6 flex items-center gap-5 flex-wrap">
          <span className="avatar-ring shrink-0"><span className="avatar-wave w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-white">
            {myAvatarConfig?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={myAvatarConfig.previewUrl} alt="" className="avatar-bob w-full h-full object-cover object-top" />
            ) : <span className="text-[24px] font-extrabold text-[#2563eb]">{(username || user?.email || '?').charAt(0).toUpperCase()}</span>}
          </span></span>
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[10px] tracking-[0.3em] text-[#60a5fa]">MY PAGE · {TAB_LABEL[tab]}</p>
            <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-white leading-tight truncate">{agentName || username || '내 계정'}</h1>
            <p className="text-[13px] text-white/60 truncate">{username && agentName ? `@${username} · ` : ''}{user?.email}{country ? ` · ${COUNTRIES.find(c => c.code === country)?.flag ?? ''} ${COUNTRIES.find(c => c.code === country)?.name ?? country}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href="/credits" className="hover:opacity-80 transition-opacity"><PromptCreditBadge amount={creditBalance} /></a>
            <GameCoinBadge amount={vcoinBalance} />
            <Link href="/studio" className="inline-flex items-center h-9 px-4 rounded-lg bg-white text-[#171b26] text-[13px] font-semibold hover:bg-[#e8f1ff] transition-colors">게임 만들기</Link>
          </div>
        </div>
      </div>
      )}
      {/* 모바일 탭 (데스크톱은 사이드 메뉴) */}
      <nav className="md:hidden -mt-6 flex items-center gap-1 rounded-full bg-[#f1ece2] p-1 overflow-x-auto scrollbar-hide" aria-label="my page sections">
        {(Object.keys(TAB_LABEL) as Tab[]).map(t => <a key={t} href={`#${t}`} className={`h-8 px-3.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap flex items-center transition-colors ${tab === t ? 'bg-white text-[#241f17] shadow-sm' : 'text-[#6b6152]'}`}>{TAB_LABEL[t]}</a>)}
      </nav>

      {/* ── Profile ── */}
      {tab === 'profile' && <section id="profile" className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] space-y-6">

        {/* Email */}
        <div>
          <p className="text-[12px] font-semibold text-[#6b6152] mb-1.5">이메일</p>
          <p className="text-sm text-[#4a4337]">{user?.email}</p>
        </div>

        {/* Username */}
        <div>
          <p className="text-[12px] font-semibold text-[#6b6152] mb-1.5">사용자 이름</p>
          {editingUsername ? (
            <div className="flex items-center gap-3 flex-wrap">
              <input className={inputClass + ' max-w-xs'} value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus />
              <button onClick={handleSaveUsername} disabled={isPending} className="inline-flex items-center h-10 px-4 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">저장</button>
              <button onClick={() => { setEditingUsername(false); setNewUsername('') }} className="inline-flex items-center h-10 px-4 rounded-lg border border-[#ddd3bf] bg-white text-[13px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">취소</button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#241f17]">{username}</span>
              <button onClick={() => { setEditingUsername(true); setNewUsername(username) }} className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ddd3bf] bg-white text-[12.5px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">수정</button>
            </div>
          )}
        </div>

        {/* Country */}
        <div>
          <p className="text-[12px] font-semibold text-[#6b6152] mb-1.5">국가</p>
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
      </section>}

      {/* ── Password ── */}
      {tab === 'password' && <section id="password" className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <p className="text-[12px] font-semibold text-[#6b6152] mb-1.5">새 비밀번호</p>
            <input type="password" className={inputClass} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="최소 6자리" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#6b6152] mb-1.5">비밀번호 확인</p>
            <input type="password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" />
          </div>
        </div>
        {pwMsg && <p className={`text-xs font-pixel tracking-widest ${pwMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{pwMsg.text}</p>}
        <button onClick={handleChangePassword} disabled={isPending || !newPassword || !confirmPassword} className="inline-flex items-center h-10 px-6 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
          비밀번호 변경
        </button>
      </section>}

      {/* ── My Agent ── */}
      {tab === 'agent' && <section id="agent" className="space-y-4">
        {/* 소개 스트립 */}
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] px-5 md:px-6 py-4 flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center text-[16px]">🎙️</span>
          <div>
            <p className="text-[13.5px] font-bold text-[#241f17]">내 AJ — 나 대신 방송하고 게임하는 AI 아바타</p>
            <p className="text-[12px] text-[#857a68] mt-0.5 leading-relaxed">외모(아바타)와 성격을 정하면, 내가 게임에 집중하는 동안 AJ와 실시간으로 대화하고 게임도 대신 플레이해요.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4 items-start">
          {/* ── 아바타 쇼케이스 스테이지 ── */}
          <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-4 relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 top-0 h-40 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(37,99,235,0.10), transparent 65%)' }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#7c3aed]">My Avatar</p>
                {myAvatarConfig && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e11d48]"><span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />방송 BJ</span>}
              </div>
              <div className="relative w-full aspect-[4/5] avatar-wave rounded-2xl overflow-hidden shadow-[0_18px_40px_-20px_rgba(37,99,235,0.5)]">
                {myAvatarConfig ? (
                <JeumtoView
                  config={myAvatarConfig}
                  onLoaded={async (snapshot) => {
                    // 옛(불투명 배경) 프리뷰면 투명 스냅샷으로 자동 재생성 — 카드 배지에서 캐릭터가 원 밖으로 튀어나오게
                    if (!user || myAvatarConfig.previewVersion === 5) return
                    await new Promise<void>((r) => requestAnimationFrame(() => r()))
                    const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob((b) => r(b), 'image/png'))
                    const blob = await toBlob(snapshot(512))
                    const blinkBlob = await toBlob(snapshot(512, { blink: true }))
                    const talkBlob = await toBlob(snapshot(512, { talk: true }))
                    if (!blob) return
                    const url = await uploadPreview(supabase, user.id, blob)
                    const blinkUrl = blinkBlob ? await uploadPreview(supabase, user.id, blinkBlob, 'blink') : null
                    const talkUrl = talkBlob ? await uploadPreview(supabase, user.id, talkBlob, 'talk') : null
                    if (!url) return
                    const next = { ...myAvatarConfig, previewUrl: url, blinkUrl, talkUrl, previewVersion: 5 }
                    const { error } = await saveAvatarConfig(supabase, user.id, next)
                    if (!error) setMyAvatarConfig(next)
                  }}
                />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 bg-white/40 backdrop-blur-sm">
                    <span className="text-4xl">🧍</span>
                    <p className="text-[12px] font-semibold text-[#241f17]">아직 아바타가 없어요</p>
                    <p className="text-[11px] text-[#857a68]">나만의 3D 캐릭터를 만들어 보세요</p>
                  </div>
                )}
                {/* 이름 오버레이 */}
                {agentName.trim() && (
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/55 to-transparent">
                    <p className="text-white font-extrabold text-[15px] leading-tight drop-shadow">{agentName}</p>
                    {agentPersona && <p className="text-white/75 text-[11px] truncate">{agentPersona}</p>}
                  </div>
                )}
              </div>
              <a href="/avatar" className="mt-3 flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[13.5px] font-bold shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)] hover:brightness-110 transition">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                {myAvatarConfig ? '아바타 수정' : '아바타 만들기'}
              </a>
              <p className="text-[11px] text-[#9d9280] mt-2 leading-relaxed text-center">저장한 아바타는 내 게임의 <b className="text-[#4a4337]">방송 BJ</b>로 등장하고, 게임에 참여시켜 <b className="text-[#4a4337]">AI 플레이</b>도 해요.</p>
            </div>
          </div>

          {/* ── 정체성 · 성격 설정 ── */}
          <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#2563eb]">Identity</p><h3 className="text-[17px] font-extrabold text-[#241f17] mt-0.5">AJ 정체성</h3></div>
              {agentMsg && <span className={`text-[12px] font-semibold ${agentMsg.ok ? 'text-[#059669]' : 'text-red-500'}`}>{agentMsg.text}</span>}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl border border-dashed border-[#ddd3bf] overflow-hidden bg-[#f6f2ea] shrink-0 flex items-center justify-center">
                {(agentAvatarFile ? URL.createObjectURL(agentAvatarFile) : agentAvatarUrl) ? (
                  <Image src={agentAvatarFile ? URL.createObjectURL(agentAvatarFile) : agentAvatarUrl} alt="agent avatar" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                ) : <span className="text-[20px]">🖼️</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#4a4337] mb-1">채팅 프로필 사진 <span className="text-[#9d9280] font-normal">(선택)</span></p>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e => setAgentAvatarFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-[#6b6152] file:mr-3 file:py-1.5 file:px-3 file:border-0 file:bg-[#241f17] file:text-white file:text-[12px] file:font-semibold file:rounded-lg file:cursor-pointer file:hover:bg-[#3a332a] file:transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-[#4a4337] mb-1.5 block">에이전트 이름</label>
              <input className={inputClass + ' !h-12 !text-[15px] !font-semibold'} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="예: 도라에몽, 코무, ..." maxLength={20} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5"><label className="text-[12px] font-semibold text-[#4a4337]">성격 · 말투</label><span className="text-[11px] text-[#9d9280]">{agentPersona.length}/100</span></div>
              <textarea className={inputClass + ' resize-y !h-auto min-h-[150px] py-3 leading-relaxed'} rows={6} value={agentPersona} onChange={e => setAgentPersona(e.target.value)} placeholder="예: 항상 긍정적이고 열정적인 게이머. 재밌으면 크게 리액션하고, 실수엔 다정하게 위로해준다." maxLength={100} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['긍정적이고 열정적인 게이머', '차분하고 분석적인 해설가', '장난기 많고 유쾌한 친구', '따뜻하게 응원하는 코치'].map(t => (
                  <button key={t} onClick={() => setAgentPersona(t)} className="text-[11px] rounded-full border border-[#e6dfd0] bg-[#faf8f3] text-[#6b6152] px-2.5 py-1 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">{t}</button>
                ))}
              </div>
            </div>

            <button onClick={handleSaveAgent} disabled={isPending || (!agentName.trim() && !agentPersona.trim())}
              className="w-full inline-flex items-center justify-center h-12 rounded-xl bg-[#2563eb] text-white text-[14px] font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)]">
              {isPending ? '저장 중…' : '저장하기'}
            </button>
          </div>
        </div>
      </section>}
      {tab === 'learning'
 && <section id="learning"><AiLearningSection /></section>}

      {/* ── My Games ── */}
      {tab === 'games' && <section id="games" className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div><h2 className="text-[17px] font-bold text-[#241f17]">내 게임 <span className="text-[#2563eb]">{games.length}</span></h2><p className="text-[12.5px] text-[#857a68] mt-0.5">게시한 게임을 수정하고 AJ 대시보드·홍보로 이동해요.</p></div>
          <div className="flex items-center gap-2">
            {gameMsg && <p className={`text-xs font-pixel tracking-widest ${gameMsg.ok ? 'text-[#2563eb]' : 'text-red-400'}`}>{gameMsg.text}</p>}
            {/* 방송 추가 — 폰 카메라로 내 게임 BJ 방송 (켜져 있는 동안 아바타 대신 영상) */}
            <a
              href="/broadcast"
              className={`inline-flex items-center h-9 px-4 rounded-lg border text-[13px] font-semibold transition-colors ${
                !!(user && (liveInfoOf(myAvatarConfig?.broadcast, user.id) || myAvatarConfig?.broadcasts?.some((b) => b.on)))
                  ? 'bg-[#e11d48] text-white border-[#e11d48] animate-pulse'
                  : 'border-[#e11d48]/50 text-[#e11d48] hover:bg-[#e11d48] hover:text-white'
              }`}
            >
              {!!(user && (liveInfoOf(myAvatarConfig?.broadcast, user.id) || myAvatarConfig?.broadcasts?.some((b) => b.on))) ? '● ON AIR · 방송 관리' : '방송 추가'}
            </a>
            <Link href="/studio" className="inline-flex items-center h-9 px-4 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] transition-colors shadow-[0_2px_8px_rgba(37,99,235,0.25)]">게임 추가</Link>
          </div>
        </div>

        {onAirGames.map((onAirGame) => (
          <div key={`onair-${onAirGame.id}`} className="mb-3 rounded-xl border border-[#e11d48]/40 bg-[#fff1f4] flex items-center gap-4 p-4">
            <div className="relative w-20 h-12 shrink-0 overflow-hidden rounded-lg bg-gray-900">
              <Image src={onAirGame.thumbnail_url} alt={onAirGame.title} fill className="object-cover" />
              <span className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-[#e11d48] text-white font-pixel text-[8px] px-1.5 py-0.5 tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#e11d48] mb-0.5">● ON AIR · 방송 중인 게임{onAirGame.user_id !== user?.id ? ' (다른 사람 게임)' : ''}</p>
              <p className="text-sm text-[#241f17] truncate font-medium">{onAirGame.title}</p>
            </div>
            <a href={`/games/${onAirGame.id}`} className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ddd3bf] bg-white text-[12.5px] font-medium text-[#4a4337] hover:border-[#2563eb]">게임 보기</a>
            <a href="/broadcast" className="inline-flex items-center h-8 px-3 rounded-lg bg-[#e11d48] text-white text-[12.5px] font-semibold">방송 관리</a>
          </div>
        ))}
        {games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd3bf] bg-[#faf8f3] p-12 text-center">
            <p className="text-[15px] font-bold text-[#241f17]">아직 등록한 게임이 없어요</p>
            <p className="text-[12.5px] text-[#857a68] mt-1 mb-4">프롬프트 한 줄로 만들거나, 이미 만든 게임을 링크로 등록해요.</p>
            <Link href="/studio" className="inline-flex items-center h-10 px-5 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold">첫 게임 만들기</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <div key={game.id} className="rounded-xl border border-[#ebe4d6] bg-white hover:border-[#cfc4ab] hover:shadow-[0_6px_18px_-10px_rgba(36,31,23,0.2)] transition-all">
                <div className="flex items-center gap-4 p-4">
                  <div className="relative w-24 h-14 shrink-0 overflow-hidden rounded-lg bg-gray-900">
                    <Image src={game.thumbnail_url} alt={game.title} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${GENRE_COLORS[game.genre]}`}>{game.genre.toUpperCase()}</span>
                      {game.language && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#4a4337] bg-[#f1ece2]">{game.language === 'ko' ? '한국어' : 'EN'}</span>
                      )}
                      {game.game_manual && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#6b6152] bg-[#f1ece2]">설명서</span>
                      )}
                    </div>
                    <p className="text-[14px] text-[#241f17] truncate font-bold">{game.title}</p>
                    <p className="text-[11.5px] text-[#9d9280] truncate mt-0.5">조회 {(game.view_count ?? 0).toLocaleString()} · {new Date(game.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`/aj/${game.id}`} title="AJ 대시보드 — 지표·분석·업데이트 제안" className="inline-flex items-center h-8 px-3 rounded-lg border border-[#2563eb]/40 bg-[#2563eb]/5 text-[12.5px] font-semibold text-[#2563eb] hover:bg-[#2563eb] hover:text-white transition-colors">AJ</a>
                    <a href={`/ads?game=${game.id}`} title="AJ AdPilot — 홍보 캠페인" className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ddd3bf] bg-white text-[12.5px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">홍보</a>
                    <button onClick={() => setCurriculumGame({ id: game.id, title: game.title })} title="AJ 학습 가이드 — 내 게임의 정석 플레이를 등록하면 모든 회원의 AI 가 배워요" className="inline-flex items-center h-8 px-3 rounded-lg border border-[#7c3aed]/40 bg-[#7c3aed]/5 text-[12.5px] font-semibold text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-colors">학습</button>
                    <button
                      onClick={() => setEditingGame({ id: game.id, title: game.title, genre: game.genre, description: game.description ?? '', language: game.language ?? 'ko', country: game.country ?? country ?? '', game_manual: game.game_manual ?? '', play_url: game.play_url, thumbnail_url: game.thumbnail_url, teaser: game.teaser ?? '', newThumbnail: null, newManual: null })}
                      className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ddd3bf] bg-white text-[12.5px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                    >
                      수정
                    </button>
                    {deleteConfirm === game.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteGame(game.id)} disabled={isPending} className="inline-flex items-center h-8 px-3 rounded-lg bg-[#e11d48] text-white text-[12.5px] font-semibold hover:bg-[#be123c] disabled:opacity-50">삭제 확인</button>
                        <button onClick={() => setDeleteConfirm(null)} className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ddd3bf] bg-white text-[12.5px] font-medium text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(game.id)} className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ebe4d6] bg-white text-[12.5px] font-medium text-[#9d9280] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">삭제</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>}

      {/* ── 좋아요한 / 공유한 게임 ── */}
      {tab === 'billing' && user && <BillingSection userId={user.id} />}
      {tab === 'notices' && <section id="notices" className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]"><NoticesSection /></section>}
      {tab === 'collections' && user && <section id="collections" className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]"><MyCollections userId={user.id} /></section>}
      {curriculumGame && <GameCurriculumModal gameId={curriculumGame.id} title={curriculumGame.title} onClose={() => setCurriculumGame(null)} />}

      {/* ── Edit Game Modal ── */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241f17]/45 backdrop-blur-[2px] px-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#ebe4d6] shadow-2xl max-h-[90svh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe4d6]">
              <p className="text-[15px] font-bold text-[#241f17]">게임 수정</p>
              <button onClick={() => setEditingGame(null)} className="w-8 h-8 rounded-lg text-[#857a68] hover:bg-[#f4efe6] hover:text-[#241f17] transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Thumbnail preview + upload */}
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">썸네일</label>
                <div className="relative w-full aspect-video mb-3 overflow-hidden rounded-xl bg-gray-900 border border-[#ebe4d6]">
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
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">TITLE</label>
                <input className={inputClass} value={editingGame.title} onChange={e => setEditingGame(prev => prev ? { ...prev, title: e.target.value } : null)} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">
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
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">게임 언어</label>
                <select className={inputClass} value={editingGame.language} onChange={e => setEditingGame(prev => prev ? { ...prev, language: e.target.value } : null)}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">게임 국가</label>
                <select className={inputClass} value={editingGame.country} onChange={e => setEditingGame(prev => prev ? { ...prev, country: e.target.value } : null)}>
                  <option value="">선택 안 함</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">AI AJ 게임 설명</label>
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
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">
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
                    file:bg-[#241f17] file:text-white file:text-[12px] file:font-semibold file:rounded-md file:cursor-pointer
                    file:hover:bg-gray-600 file:transition-colors"
                />
                {editingGame.newManual && <p className="text-xs text-[#6b6152] mt-1">선택됨: {editingGame.newManual.name}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">GENRE</label>
                <select className={inputClass} value={editingGame.genre} onChange={e => setEditingGame(prev => prev ? { ...prev, genre: e.target.value as Genre } : null)}>
                  {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#6b6152] mb-1.5">PLAY URL</label>
                <input className={inputClass} value={editingGame.play_url} onChange={e => setEditingGame(prev => prev ? { ...prev, play_url: e.target.value } : null)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveGame} disabled={isPending} className="flex-1 h-11 rounded-xl bg-[#2563eb] text-white text-[14px] font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">
                  {isPending ? 'SAVING...' : 'SAVE'}
                </button>
                <button onClick={() => setEditingGame(null)} className="flex-1 h-11 rounded-xl border border-[#ddd3bf] bg-white text-[14px] font-semibold text-[#4a4337] hover:border-[#2563eb] transition-colors">
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


// ── 결제 내역 · 크레딧 사용 내역 ──
function BillingSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [pays, setPays] = useState<{ id: string; created_at: string; amount_minor: number | null; currency: string | null; credits: number; status: string; pack_key: string | null; card_brand: string | null; card_last4: string | null; refund_reason: string | null }[] | null>(null)
  const [ledger, setLedger] = useState<{ id: string; amount: number; reason: string; created_at: string }[] | null>(null)
  useEffect(() => {
    supabase.from('payments').select('id,created_at,amount_minor,currency,credits,status,pack_key,card_brand,card_last4,refund_reason').eq('user_id', userId).order('created_at', { ascending: false }).limit(50).then(({ data }) => setPays((data as typeof pays) ?? []))
    supabase.from('credit_ledger').select('id,amount,reason,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50).then(({ data }) => setLedger((data as typeof ledger) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  const money = (m: number | null, c: string | null) => { if (m == null) return '—'; const cc = (c ?? 'USD').toUpperCase(); const zero = ['KRW', 'JPY', 'VND', 'CLP', 'ISK', 'HUF', 'TWD'].includes(cc); return new Intl.NumberFormat(cc === 'KRW' ? 'ko-KR' : 'en-US', { style: 'currency', currency: cc, minimumFractionDigits: zero ? 0 : 2 }).format(zero ? m : m / 100) }
  const PACK: Record<string, string> = { small: 'Starter · 100', medium: 'Creator · 450', large: 'Studio · 1,250' }
  const ST: Record<string, [string, string]> = { completed: ['완료', 'bg-emerald-50 text-emerald-600'], refunded: ['환불', 'bg-rose-50 text-rose-600'], partially_refunded: ['부분 환불', 'bg-rose-50 text-rose-600'], refund_pending: ['환불 검토', 'bg-amber-50 text-amber-600'], failed: ['실패', 'bg-rose-50 text-rose-600'], canceled: ['취소', 'bg-[#f1ece2] text-[#6b6152]'], chargeback: ['차지백', 'bg-rose-50 text-rose-600'] }
  const REASON: Record<string, string> = { purchase: '크레딧 구매', generation: '게임 생성·수정', refund: '생성 실패 환불', signup_bonus: '가입 보너스', admin_adjust: '관리자 조정', purchase_refund: '결제 환불 회수', chargeback: '차지백 회수' }
  return (
    <section id="billing" className="space-y-6">
      <div className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div><h2 className="text-[17px] font-bold text-[#241f17]">결제 내역</h2><p className="text-[12.5px] text-[#857a68] mt-0.5">프롬코인 구매 기록이에요. 완료된 결제는 영수증(PDF)을 받을 수 있어요.</p></div>
          <Link href="/credits" className="inline-flex items-center h-9 px-4 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8]">크레딧 충전</Link>
        </div>
        {pays === null ? <p className="text-[13px] text-[#9d9280]">불러오는 중…</p> : pays.length === 0 ? <p className="rounded-xl bg-[#faf8f3] p-8 text-center text-[13px] text-[#857a68]">아직 결제 내역이 없어요.</p> : (
          <ul className="divide-y divide-[#f0eadf]">
            {pays.map(h => { const [l, c] = ST[h.status] ?? [h.status, 'bg-[#f1ece2] text-[#6b6152]']; return (
              <li key={h.id} className="flex items-center gap-4 py-3 text-[13px]">
                <span className="text-[#857a68] whitespace-nowrap w-24">{new Date(h.created_at).toLocaleDateString()}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-[#241f17] truncate">{PACK[h.pack_key ?? ''] ?? '크레딧'} · +{h.credits.toLocaleString()} 크레딧</p><p className="text-[11.5px] text-[#9d9280] truncate">{h.card_brand ? `${h.card_brand} ••${h.card_last4}` : ''}{h.status === 'failed' && h.refund_reason ? ` · ${h.refund_reason}` : ''}</p></div>
                <span className="tabular-nums text-[#4a4337]">{money(h.amount_minor, h.currency)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{l}</span>
                {h.status === 'completed' && <a href={`/api/payments/receipt?id=${h.id}`} target="_blank" rel="noreferrer" className="text-[11.5px] text-[#2563eb] hover:underline whitespace-nowrap">영수증</a>}
              </li>) })}
          </ul>
        )}
      </div>
      <div className="rounded-2xl bg-white p-6 md:p-7 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)]">
        <h2 className="text-[17px] font-bold text-[#241f17] mb-4">크레딧 사용 내역</h2>
        {ledger === null ? <p className="text-[13px] text-[#9d9280]">불러오는 중…</p> : ledger.length === 0 ? <p className="text-[13px] text-[#857a68]">기록이 없어요.</p> : (
          <ul className="divide-y divide-[#f0eadf]">
            {ledger.map(l => (
              <li key={l.id} className="flex items-center gap-4 py-2.5 text-[13px]">
                <span className="text-[#857a68] whitespace-nowrap w-24">{new Date(l.created_at).toLocaleDateString()}</span>
                <span className="flex-1 text-[#241f17]">{REASON[l.reason] ?? l.reason}</span>
                <span className={`tabular-nums font-semibold ${l.amount >= 0 ? 'text-emerald-600' : 'text-[#e11d48]'}`}>{l.amount >= 0 ? '+' : ''}{l.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
