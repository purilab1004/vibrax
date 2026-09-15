'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

// 피드에는 카드마다 좋아요 버튼이 있다(수십 개). 예전엔 카드마다 auth.getUser()(네트워크) + 조회 2건을 마운트 즉시 날려
// supabase-js 의 인증 락(navigator.locks)에 수십 건이 줄을 섰고, 그 뒤에 온 '코인 넣기'의 getSession 이 다 끝날 때까지 기다렸다.
// → 사용자 ID 는 한 번만(로컬 세션, 네트워크 없음) 공유하고, 조회는 카드가 화면 근처에 왔을 때만 한다.
let uidOnce: Promise<string | null> | null = null
function userIdOnce(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  if (!uidOnce) {
    uidOnce = supabase.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null).catch(() => null)
    supabase.auth.onAuthStateChange((_e, session) => { uidOnce = Promise.resolve(session?.user?.id ?? null) })
  }
  return uidOnce
}

interface Props {
  gameId: string
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean   // 어두운 배경(유리 버튼) 위에서 흰색 톤
}

export default function LikeButton({ gameId, size = 'sm', dark = false }: Props) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const rootRef = useRef<HTMLButtonElement>(null)
  const [near, setNear] = useState(false)

  // 화면 근처(위아래 한 화면)에 왔을 때만 조회 시작
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { const t = setTimeout(() => setNear(true), 0); return () => clearTimeout(t) }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '100% 0px 100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!near) return
    let alive = true
    userIdOnce(supabase).then((id) => { if (alive) setUserId(id) })
    supabase
      .from('game_likes')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .then(({ count: c }) => { if (alive) setCount(c ?? 0) })
    return () => { alive = false }
  }, [gameId, near])

  useEffect(() => {
    if (!userId || !near) return
    let alive = true
    supabase
      .from('game_likes')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (alive) setLiked(!!data) })
    return () => { alive = false }
  }, [gameId, userId, near])

  const toggle = () => {
    if (!userId) return
    startTransition(async () => {
      if (liked) {
        await supabase.from('game_likes').delete().eq('game_id', gameId).eq('user_id', userId)
        setLiked(false)
        setCount(c => Math.max(0, c - 1))
      } else {
        await supabase.from('game_likes').insert({ game_id: gameId, user_id: userId } as never)
        setLiked(true)
        setCount(c => c + 1)
      }
    })
  }

  const textSize = size === 'lg' ? 'text-[14px]' : size === 'md' ? 'text-xs' : 'text-[11px]'
  const iconSize = size === 'lg' ? 'text-[22px] leading-none' : size === 'md' ? 'text-sm' : 'text-[11px]'

  return (
    <button
      ref={rootRef}
      onClick={e => { e.stopPropagation(); toggle() }}
      disabled={isPending || !userId}
      title={userId ? undefined : '로그인 후 좋아요 가능'}
      className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
        liked
          ? 'text-red-400'
          : dark ? 'text-white/90 hover:text-red-400' : 'text-[#857a68] hover:text-red-400'
      } ${!userId ? 'opacity-60' : ''}`}
    >
      <span className={iconSize}>{liked ? '♥' : '♡'}</span>
      <span className={`${textSize} font-pixel`}>{count}</span>
    </button>
  )
}
