'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import CategoryManager from '@/components/admin/CategoryManager'

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [cats, setCats] = useState<BlogCategory[]>([])
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    supabase.from('blog_posts').select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts((data as BlogPost[] | null) ?? []))
    supabase.from('blog_categories').select('*')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    await supabase.from('blog_posts').delete().eq('id', id)
    load()
  }

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest">{a.blogHeading}</h1>
        <Link href="/admin/blog/new" className="font-pixel text-[10px] bg-[#00ff41] text-black px-4 py-2.5 hover:bg-[#00cc33] transition-colors tracking-widest">
          {a.newPost}
        </Link>
      </div>
      <div className="mb-8"><CategoryManager onChanged={load} /></div>
      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">{a.noPosts}</p>
      ) : (
        <div className="border border-gray-800 divide-y divide-gray-800">
          {posts.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-[#111]">
              <span className={`font-pixel text-[8px] tracking-widest px-1.5 py-0.5 border shrink-0 ${
                p.published ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-700 text-gray-500'
              }`}>
                {p.published ? a.published : a.draft}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm truncate">{p.title || '—'}</p>
                <p className="text-[10px] text-gray-600">
                  {catName(p.category_id)} · {new Date(p.created_at).toLocaleDateString()} · 👁 {p.view_count}
                </p>
              </div>
              <Link href={`/admin/blog/${p.id}`} className="font-pixel text-[9px] text-gray-400 hover:text-[#00ff41] tracking-widest shrink-0">
                {a.edit}
              </Link>
              <button onClick={() => remove(p.id)} className="font-pixel text-[9px] text-gray-600 hover:text-red-400 tracking-widest shrink-0">
                {a.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
