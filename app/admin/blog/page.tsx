'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import ViewerIcon from '@/components/ViewerIcon'
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
        <h1 className="font-pixel text-[#0e7573] text-base tracking-widest">{a.blogHeading}</h1>
        <Link href="/admin/blog/new" className="font-pixel text-xs bg-[#0e7573] text-[#241f17] px-4 py-2.5 hover:bg-[#0a5d5b] transition-colors tracking-widest">
          {a.newPost}
        </Link>
      </div>
      <div className="mb-8"><CategoryManager onChanged={load} /></div>
      {posts.length === 0 ? (
        <p className="text-[#857a68] text-base">{a.noPosts}</p>
      ) : (
        <div className="border border-[#e8dfcf] divide-y divide-[#e8dfcf]">
          {posts.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-4 py-3 bg-[#fffdf8]">
              <span className={`font-pixel text-[10px] tracking-widest px-1.5 py-0.5 border shrink-0 ${
                p.published ? 'border-[#0e7573] text-[#0e7573]' : 'border-[#d9cdb4] text-[#857a68]'
              }`}>
                {p.published ? a.published : a.draft}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[#241f17] text-base truncate">{p.title || '—'}</p>
                <p className="text-xs text-[#9d9280]">
                  {catName(p.category_id)} · {new Date(p.created_at).toLocaleDateString()} · <ViewerIcon className="w-3 h-3 inline align-[-2px]" /> {p.view_count}
                </p>
              </div>
              <Link href={`/admin/blog/${p.id}`} className="font-pixel text-[11px] text-[#6b6152] hover:text-[#0e7573] tracking-widest shrink-0">
                {a.edit}
              </Link>
              <button onClick={() => remove(p.id)} className="font-pixel text-[11px] text-[#9d9280] hover:text-red-400 tracking-widest shrink-0">
                {a.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
