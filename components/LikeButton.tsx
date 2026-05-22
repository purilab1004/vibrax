'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gameId: string
  size?: 'sm' | 'md'
}

export default function LikeButton({ gameId, size = 'sm' }: Props) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })

    supabase
      .from('game_likes')
      .select('id', { count: 'exact' })
      .eq('game_id', gameId)
      .then(({ count: c }) => setCount(c ?? 0))
  }, [gameId])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('game_likes')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [gameId, userId])

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

  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]'
  const iconSize = size === 'md' ? 'text-sm' : 'text-[11px]'

  return (
    <button
      onClick={e => { e.stopPropagation(); toggle() }}
      disabled={isPending || !userId}
      title={userId ? undefined : '로그인 후 좋아요 가능'}
      className={`flex items-center gap-1 transition-colors disabled:cursor-default ${
        liked
          ? 'text-red-400'
          : 'text-gray-500 hover:text-red-400'
      } ${!userId ? 'opacity-60' : ''}`}
    >
      <span className={iconSize}>{liked ? '♥' : '♡'}</span>
      <span className={`${textSize} font-pixel`}>{count}</span>
    </button>
  )
}
