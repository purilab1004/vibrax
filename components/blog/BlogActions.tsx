'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

// 블로그 좋아요 + 공유 — 목록 행과 상세 페이지 공용
export default function BlogActions({ postId, size = 'sm' }: { postId: string; size?: 'sm' | 'md' }) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const { T } = useLang()
  const b = T.blog

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    supabase.from('blog_post_likes').select('id', { count: 'exact' }).eq('post_id', postId)
      .then(({ count: c }) => setCount(c ?? 0))
  }, [postId])

  useEffect(() => {
    if (!userId) return
    supabase.from('blog_post_likes').select('id')
      .eq('post_id', postId).eq('user_id', userId).maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [postId, userId])

  const toggle = () => {
    if (!userId) return
    startTransition(async () => {
      if (liked) {
        await supabase.from('blog_post_likes').delete().eq('post_id', postId).eq('user_id', userId)
        setLiked(false)
        setCount(c => Math.max(0, c - 1))
      } else {
        await supabase.from('blog_post_likes').insert({ post_id: postId, user_id: userId } as never)
        setLiked(true)
        setCount(c => c + 1)
      }
    })
  }

  const share = async () => {
    const url = `${window.location.origin}/blog/${postId}`
    try {
      if (navigator.share) {
        await navigator.share({ url })
        return
      }
    } catch { /* 공유 취소 — 클립보드 폴백 진행 */ }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* 클립보드 실패는 무시 */ }
  }

  const text = size === 'md' ? 'text-sm' : 'text-[13px]'

  return (
    <span className={`flex items-center gap-4 ${text}`} onClick={e => { e.preventDefault(); e.stopPropagation() }}>
      <button
        onClick={toggle}
        disabled={isPending || !userId}
        title={userId ? undefined : b.loginToLike}
        className={`flex items-center gap-1.5 transition-colors disabled:cursor-default ${
          liked ? 'text-red-400' : 'text-[#857a68] hover:text-red-400'
        } ${!userId ? 'opacity-60' : ''}`}
      >
        <span>{liked ? '♥' : '♡'}</span>
        <span>{count}</span>
      </button>
      <button
        onClick={share}
        className="flex items-center gap-1.5 text-[#857a68] hover:text-[#0e7573] transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
        </svg>
        <span>{copied ? b.copied : b.share}</span>
      </button>
    </span>
  )
}
