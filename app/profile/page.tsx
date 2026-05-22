'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Game, Genre } from '@/lib/supabase/types'

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
  play_url: string
  thumbnail_url: string
  newThumbnail?: File | null
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

      const { error } = await supabase.from('games').update({
        title: editingGame.title,
        genre: editingGame.genre,
        play_url: editingGame.play_url,
        thumbnail_url: thumbnailUrl,
      } as never).eq('id', editingGame.id)

      if (error) { flash(setGameMsg, '저장 실패: ' + error.message, false); return }
      setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, title: editingGame.title, genre: editingGame.genre, play_url: editingGame.play_url, thumbnail_url: thumbnailUrl } : g))
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

  const inputClass = 'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-2.5 text-sm outline-none transition-colors text-white placeholder-gray-500'

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="font-pixel text-[10px] text-gray-400 tracking-widest">LOADING...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">MY PAGE</h1>

      {/* ── Profile ── */}
      <section className="border border-gray-800 bg-[#0d0d0d] p-6 space-y-6">
        <h2 className="font-pixel text-[10px] text-gray-400 tracking-widest">PROFILE</h2>

        {/* Email */}
        <div>
          <p className="font-pixel text-[9px] text-gray-600 tracking-widest mb-1">EMAIL</p>
          <p className="text-sm text-gray-300">{user?.email}</p>
        </div>

        {/* Username */}
        <div>
          <p className="font-pixel text-[9px] text-gray-600 tracking-widest mb-2">USERNAME</p>
          {editingUsername ? (
            <div className="flex items-center gap-3 flex-wrap">
              <input className={inputClass + ' max-w-xs'} value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus />
              <button onClick={handleSaveUsername} disabled={isPending} className="font-pixel text-[10px] bg-[#00ff41] text-black px-4 py-2 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest">SAVE</button>
              <button onClick={() => { setEditingUsername(false); setNewUsername('') }} className="font-pixel text-[10px] border border-gray-700 text-gray-400 px-4 py-2 hover:border-gray-500 transition-colors tracking-widest">CANCEL</button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm text-white">{username}</span>
              <button onClick={() => { setEditingUsername(true); setNewUsername(username) }} className="font-pixel text-[9px] text-gray-500 hover:text-[#00ff41] transition-colors border border-gray-800 hover:border-[#00ff41] px-3 py-1 tracking-widest">EDIT</button>
            </div>
          )}
          {profileMsg && <p className={`text-xs font-pixel tracking-widest mt-2 ${profileMsg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{profileMsg.text}</p>}
        </div>
      </section>

      {/* ── Password ── */}
      <section className="border border-gray-800 bg-[#0d0d0d] p-6 space-y-4">
        <h2 className="font-pixel text-[10px] text-gray-400 tracking-widest">CHANGE PASSWORD</h2>
        <div>
          <p className="font-pixel text-[9px] text-gray-600 tracking-widest mb-2">NEW PASSWORD</p>
          <input type="password" className={inputClass + ' max-w-xs'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="최소 6자리" />
        </div>
        <div>
          <p className="font-pixel text-[9px] text-gray-600 tracking-widest mb-2">CONFIRM PASSWORD</p>
          <input type="password" className={inputClass + ' max-w-xs'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" />
        </div>
        {pwMsg && <p className={`text-xs font-pixel tracking-widest ${pwMsg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{pwMsg.text}</p>}
        <button onClick={handleChangePassword} disabled={isPending || !newPassword || !confirmPassword} className="font-pixel text-[10px] bg-[#00ff41] text-black px-6 py-2.5 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest">
          CHANGE PASSWORD
        </button>
      </section>

      {/* ── My Games ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-pixel text-[10px] text-gray-400 tracking-widest">MY GAMES <span className="text-[#00ff41]">({games.length})</span></h2>
          {gameMsg && <p className={`text-xs font-pixel tracking-widest ${gameMsg.ok ? 'text-[#00ff41]' : 'text-red-400'}`}>{gameMsg.text}</p>}
        </div>

        {games.length === 0 ? (
          <div className="border border-gray-800 p-12 text-center">
            <p className="text-gray-500 text-sm mb-4">아직 등록한 게임이 없습니다.</p>
            <a href="/submit" className="font-pixel text-[10px] text-[#00ff41] hover:underline tracking-widest">+ 첫 게임 등록하기</a>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <div key={game.id} className="border border-gray-800 bg-[#0d0d0d] hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-4 p-4">
                  <div className="relative w-20 h-12 shrink-0 overflow-hidden bg-gray-900">
                    <Image src={game.thumbnail_url} alt={game.title} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-pixel text-[8px] px-1.5 py-0.5 text-white ${GENRE_COLORS[game.genre]}`}>{game.genre.toUpperCase()}</span>
                    </div>
                    <p className="text-sm text-white truncate font-medium">{game.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{game.play_url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingGame({ id: game.id, title: game.title, genre: game.genre, play_url: game.play_url, thumbnail_url: game.thumbnail_url, newThumbnail: null })}
                      className="font-pixel text-[9px] border border-gray-700 text-gray-400 hover:border-[#00ff41] hover:text-[#00ff41] px-3 py-1.5 transition-colors tracking-widest"
                    >
                      EDIT
                    </button>
                    {deleteConfirm === game.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteGame(game.id)} disabled={isPending} className="font-pixel text-[9px] bg-red-700 text-white px-3 py-1.5 hover:bg-red-600 transition-colors disabled:opacity-50 tracking-widest">확인</button>
                        <button onClick={() => setDeleteConfirm(null)} className="font-pixel text-[9px] border border-gray-700 text-gray-400 px-3 py-1.5 tracking-widest">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(game.id)} className="font-pixel text-[9px] border border-gray-800 text-gray-600 hover:border-red-700 hover:text-red-400 px-3 py-1.5 transition-colors tracking-widest">DEL</button>
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
          <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <p className="font-pixel text-[10px] text-[#00ff41] tracking-widest">EDIT GAME</p>
              <button onClick={() => setEditingGame(null)} className="font-pixel text-[10px] text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Thumbnail preview + upload */}
              <div>
                <label className="block font-pixel text-[9px] text-gray-500 tracking-widest mb-2">THUMBNAIL</label>
                <div className="relative w-full aspect-video mb-3 overflow-hidden bg-gray-900 border border-gray-800">
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
                  className="w-full bg-[#0d0d0d] border border-gray-700 px-4 py-2.5 text-sm text-gray-400
                    file:mr-4 file:py-1 file:px-3 file:border-0
                    file:bg-[#00ff41] file:text-black file:text-[10px] file:font-pixel file:cursor-pointer
                    file:hover:bg-[#00cc33] file:transition-colors"
                />
                {editingGame.newThumbnail && <p className="text-xs text-gray-400 mt-1">선택됨: {editingGame.newThumbnail.name}</p>}
              </div>

              <div>
                <label className="block font-pixel text-[9px] text-gray-500 tracking-widest mb-2">TITLE</label>
                <input className={inputClass} value={editingGame.title} onChange={e => setEditingGame(prev => prev ? { ...prev, title: e.target.value } : null)} />
              </div>
              <div>
                <label className="block font-pixel text-[9px] text-gray-500 tracking-widest mb-2">GENRE</label>
                <select className={inputClass} value={editingGame.genre} onChange={e => setEditingGame(prev => prev ? { ...prev, genre: e.target.value as Genre } : null)}>
                  {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-pixel text-[9px] text-gray-500 tracking-widest mb-2">PLAY URL</label>
                <input className={inputClass} value={editingGame.play_url} onChange={e => setEditingGame(prev => prev ? { ...prev, play_url: e.target.value } : null)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveGame} disabled={isPending} className="flex-1 font-pixel text-[10px] bg-[#00ff41] text-black py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest">
                  {isPending ? 'SAVING...' : 'SAVE'}
                </button>
                <button onClick={() => setEditingGame(null)} className="flex-1 font-pixel text-[10px] border border-gray-700 text-gray-400 py-3 hover:border-gray-500 transition-colors tracking-widest">
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
