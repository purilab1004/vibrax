'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 서버 컴포넌트가 된 블로그 상세에서 조회수 증가만 담당하는 클라이언트 조각
export default function BlogViewPing({ postId }: { postId: string }) {
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('increment_blog_view' as never, { p_post_id: postId } as never).then(() => {})
  }, [postId])
  return null
}
