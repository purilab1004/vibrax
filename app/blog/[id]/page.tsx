'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

export default function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined)
  const [cat, setCat] = useState<BlogCategory | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const b = T.blog

  useEffect(() => {
    supabase.from('blog_posts').select('*').eq('id', id).eq('published', true).maybeSingle()
      .then(async ({ data }) => {
        const p = data as BlogPost | null
        setPost(p)
        if (p) {
          supabase.rpc('increment_blog_view' as never, { p_post_id: p.id } as never).then(() => {})
          if (p.category_id) {
            const { data: c } = await supabase.from('blog_categories').select('*').eq('id', p.category_id).maybeSingle()
            setCat(c as BlogCategory | null)
          }
        }
      })
  }, [id])

  if (post === undefined) return null
  if (post === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-400 text-sm mb-6">{b.notFound}</p>
        <Link href="/blog" className="font-pixel text-[10px] text-[#00ff41] tracking-widest">{b.back}</Link>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/blog" className="font-pixel text-[9px] text-gray-500 hover:text-[#00ff41] tracking-widest">← {b.back}</Link>
      <h1 className="text-white text-2xl md:text-3xl font-bold mt-6 mb-3">{post.title}</h1>
      <p className="text-[11px] text-gray-500 mb-8">
        {cat && <span className="text-[#00ff41] mr-3">{cat.name}</span>}
        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''} · {b.views(post.view_count)}
      </p>
      {post.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnail_url} alt={post.title} className="w-full mb-8 border border-gray-800" />
      )}
      {/* content는 RLS로 admin만 작성 가능 — 신뢰 경계 내 HTML */}
      <div className="rte-content" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
