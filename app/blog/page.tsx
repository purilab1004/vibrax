'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import { formatViewers } from '@/lib/format'
import BlogActions from '@/components/blog/BlogActions'

const RANK_COLOR = ['text-[#c9940c]', 'text-[#4a4337]', 'text-amber-600']

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [activeCat, setActiveCat] = useState<string>('')
  const supabase = createClient()
  const { T } = useLang()
  const b = T.blog

  useEffect(() => {
    supabase.from('blog_categories').select('*').order('sort_order')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  }, [])

  useEffect(() => {
    let q = supabase.from('blog_posts').select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
    if (activeCat) q = q.eq('category_id', activeCat)
    q.then(({ data }) => setPosts((data as BlogPost[] | null) ?? []))
  }, [activeCat])

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? ''
  const popular = [...(posts ?? [])].sort((a, z) => (z.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 5)

  const catBtn = (id: string, label: string) => (
    <button
      key={id || 'all'}
      onClick={() => setActiveCat(id)}
      className={`text-[13px] font-medium px-4 py-2 rounded-full border transition-colors ${
        activeCat === id ? 'border-[#0284c7] text-[#241f17] bg-[#0284c7]' : 'border-[#ebe4d6] text-[#6b6152] hover:text-[#241f17] hover:border-[#cfc4ab]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#0284c7] text-base tracking-widest mb-6">{b.heading}</h1>
      <div className="flex justify-between gap-2 flex-wrap mb-6">
        <div className="flex gap-2 flex-wrap">
          {catBtn('', b.all)}
          {cats.map(c => catBtn(c.id, c.name))}
        </div>
        <Link href="/notices" className="text-[13px] font-medium px-4 py-2 rounded-full border border-[#ebe4d6] text-[#857a68] hover:text-[#0284c7] hover:border-[#0284c7] transition-colors">
          {T.notices.heading} →
        </Link>
      </div>

      <div className="flex gap-8 items-start">
        {/* 레딧식 피드 */}
        <div className="flex-1 min-w-0 space-y-3">
          {posts === null ? null : posts.length === 0 ? (
            <p className="text-[#857a68] text-base">{b.empty}</p>
          ) : (
            posts.map(p => (
              <Link
                key={p.id}
                href={`/blog/${p.id}`}
                className="flex gap-4 p-4 bg-[#ffffff] border border-[#ebe4d6] rounded-xl hover:border-[#cfc4ab] transition-colors group"
              >
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt="" className="hidden sm:block w-32 h-24 object-cover rounded-lg border border-[#ebe4d6] shrink-0" />
                ) : (
                  <div className="hidden sm:flex w-32 h-24 rounded-lg border border-[#ebe4d6] shrink-0 items-center justify-center bg-[#ffffff]">
                    <span className="font-pixel text-[#0284c7]/25 text-[10px]">VIBREX<span className="text-[#c9940c]/25">CUP</span></span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#857a68] mb-1">
                    {catName(p.category_id) && <span className="text-[#0284c7] font-medium mr-2">{catName(p.category_id)}</span>}
                    {p.published_at ? new Date(p.published_at).toLocaleDateString('ko-KR') : ''}
                  </p>
                  <h2 className="text-[17px] font-semibold text-[#241f17] leading-snug line-clamp-2 group-hover:text-[#0284c7] transition-colors">
                    {p.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#857a68] line-clamp-2">{p.excerpt}</p>
                  <div className="mt-2.5 flex items-center gap-4 text-[13px] text-[#857a68]">
                    <span className="flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" /></svg>
                      {formatViewers(p.view_count)}
                    </span>
                    <BlogActions postId={p.id} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* 우측 POPULAR 레일 */}
        <aside className="hidden lg:block w-80 shrink-0 sticky top-20">
          <div className="border border-[#ebe4d6] bg-[#ffffff] rounded-xl overflow-hidden">
            <p className="px-5 py-3.5 border-b border-[#ebe4d6] font-pixel text-[11px] text-[#0284c7] tracking-widest">
              🔥 {b.popular}
            </p>
            <div className="divide-y divide-[#ebe4d6]/70">
              {popular.map((p, i) => (
                <Link key={p.id} href={`/blog/${p.id}`} className="flex gap-3 px-5 py-3.5 hover:bg-[#241f17]/5 transition-colors group">
                  <span className={`font-pixel text-[13px] shrink-0 ${RANK_COLOR[i] ?? 'text-[#9d9280]'}`}>#{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-[#3a332a] leading-snug line-clamp-2 group-hover:text-[#0284c7] transition-colors">{p.title}</span>
                    <span className="block mt-1 text-xs text-[#9d9280]">{b.views(p.view_count)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
