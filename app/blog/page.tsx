'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

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

  const catBtn = (id: string, label: string) => (
    <button
      key={id || 'all'}
      onClick={() => setActiveCat(id)}
      className={`font-pixel text-[10px] tracking-widest px-4 py-2 border transition-colors ${
        activeCat === id ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-500 hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-8">{b.heading}</h1>
      <div className="flex justify-between gap-2 flex-wrap mb-8">
        <div className="flex gap-2 flex-wrap">
          {catBtn('', b.all)}
          {cats.map(c => catBtn(c.id, c.name))}
        </div>
        <Link href="/notices" className="font-pixel text-[10px] tracking-widest px-4 py-2 border border-gray-800 text-gray-500 hover:text-[#00ff41] hover:border-[#00ff41] transition-colors">
          {T.notices.heading} →
        </Link>
      </div>
      {posts === null ? null : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">{b.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map(p => (
            <Link key={p.id} href={`/blog/${p.id}`} className="border border-gray-800 bg-[#111] hover:border-[#00ff41] transition-colors group">
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt={p.title} className="w-full aspect-video object-cover border-b border-gray-800" />
              ) : (
                <div className="w-full aspect-video border-b border-gray-800 flex items-center justify-center">
                  <span className="font-pixel text-[#00ff41]/30 text-xs">VIBRAX</span>
                </div>
              )}
              <div className="p-4">
                <h2 className="text-white text-sm mb-2 line-clamp-2 group-hover:text-[#00ff41] transition-colors">{p.title}</h2>
                <p className="text-gray-500 text-xs line-clamp-2 mb-3">{p.excerpt}</p>
                <p className="text-[10px] text-gray-600">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString() : ''} · {b.views(p.view_count)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
