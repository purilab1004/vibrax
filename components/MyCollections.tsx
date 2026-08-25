'use client'
// 내 페이지 — 좋아요한 게임 / 공유한 게임 모아보기 (항목 삭제 가능)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { formatViewers } from '@/lib/format'

type Row = Game & { profiles?: { username?: string | null; agent_name?: string | null } | null }

async function fetchGamesByIds(ids: string[]): Promise<Row[]> {
  if (!ids.length) return []
  const supabase = createClient()
  const { data } = await supabase.from('games').select('*, profiles(username, agent_name)').in('id', ids)
  const byId = new Map(((data ?? []) as Row[]).map((g) => [g.id, g]))
  return ids.map((id) => byId.get(id)).filter(Boolean) as Row[]
}

function Section({ title, icon, games, empty, loading, onRemove, removeLabel }: { title: string; icon: string; games: Row[]; empty: string; loading: boolean; onRemove: (id: string) => void; removeLabel: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const remove = async (id: string) => { setBusy(id); await onRemove(id); setBusy(null) }
  return (
    <section>
      <h2 className="font-pixel text-[11px] text-[#6b6152] tracking-widest mb-4">{icon} {title} <span className="text-[#2563eb]">({games.length})</span></h2>
      {loading ? (
        <p className="text-[12px] text-[#857a68]">불러오는 중…</p>
      ) : games.length === 0 ? (
        <div className="rounded-2xl bg-[#faf8f3] p-8 text-center text-[#857a68] text-sm">{empty}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {games.map((g) => (
            <div key={g.id} className="group relative rounded-xl bg-white shadow-[0_1px_2px_rgba(36,31,23,0.05),0_8px_24px_-18px_rgba(36,31,23,0.25)] hover:shadow-[0_12px_32px_-16px_rgba(36,31,23,0.35)] hover:-translate-y-0.5 transition-all overflow-hidden">
              <button
                onClick={(e) => { e.preventDefault(); remove(g.id) }}
                disabled={busy === g.id}
                aria-label={removeLabel}
                title={removeLabel}
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#e11d48] transition-all disabled:opacity-60"
              >
                {busy === g.id ? <span className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> : <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>}
              </button>
              <Link href={`/games/${g.id}`} className="block">
                <div className="relative aspect-video bg-gray-900">
                  <Image src={g.thumbnail_url} alt={g.title} fill className="object-cover group-hover:scale-[1.03] transition-transform" />
                </div>
                <div className="p-2.5">
                  <p className="text-[13px] font-semibold text-[#241f17] truncate">{g.title}</p>
                  <p className="text-[11px] text-[#857a68] truncate">{g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown'} · 👤 {formatViewers(g.view_count ?? 0)}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MyCollections({ userId }: { userId: string }) {
  const [liked, setLiked] = useState<Row[]>([])
  const [shared, setShared] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const supabase = createClient()
      const [{ data: likes }, sharesRes] = await Promise.all([
        supabase.from('game_likes').select('game_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
        supabase.from('game_shares').select('game_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      ])
      const likedIds = ((likes ?? []) as { game_id: string }[]).map((r) => r.game_id)
      const sharedIds = ((sharesRes.data ?? []) as { game_id: string }[]).map((r) => r.game_id) // 테이블이 없으면 data 가 null → 빈 목록
      const [l, s] = await Promise.all([fetchGamesByIds(likedIds), fetchGamesByIds(sharedIds)])
      if (!alive) return
      setLiked(l); setShared(s); setLoading(false)
    })()
    return () => { alive = false }
  }, [userId])

  const removeLiked = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('game_likes').delete().eq('user_id', userId).eq('game_id', id)
    if (!error) setLiked((rs) => rs.filter((g) => g.id !== id))
  }
  const removeShared = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('game_shares').delete().eq('user_id', userId).eq('game_id', id)
    if (!error) setShared((rs) => rs.filter((g) => g.id !== id))
  }

  return (
    <div className="space-y-10">
      <Section title="LIKED GAMES · 좋아요한 게임" icon="❤️" games={liked} empty="아직 좋아요한 게임이 없어요. 마음에 드는 게임에 ❤️를 눌러 보세요." loading={loading} onRemove={removeLiked} removeLabel="좋아요 취소" />
      <Section title="SHARED GAMES · 공유한 게임" icon="🔗" games={shared} empty="아직 공유한 게임이 없어요. 게임 페이지의 공유 버튼을 누르면 여기에 모여요." loading={loading} onRemove={removeShared} removeLabel="목록에서 제거" />
    </div>
  )
}
