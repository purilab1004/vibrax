'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'
import { makeExcerpt } from '@/lib/blog/excerpt'

export default function BlogPostForm({ postId }: { postId?: string }) {
  const [loaded, setLoaded] = useState(!postId)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(false)
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'failed' | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.from('blog_categories').select('*').order('sort_order')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
    if (postId) {
      supabase.from('blog_posts').select('*').eq('id', postId).maybeSingle().then(({ data }) => {
        const p = data as BlogPost | null
        if (p) {
          setTitle(p.title)
          setCategoryId(p.category_id ?? '')
          setThumbnailUrl(p.thumbnail_url)
          setContent(p.content)
          setPublished(p.published)
        }
        setLoaded(true)
      })
    }
  }, [postId])

  const uploadThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadBlogImage(supabase, file)
    if (url) setThumbnailUrl(url)
  }

  const save = async (nextPublished: boolean) => {
    if (saving) return
    setSaving(true)
    setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const row = {
        title: title.trim() || a.postTitle,
        category_id: categoryId || null,
        thumbnail_url: thumbnailUrl,
        content,
        excerpt: makeExcerpt(content),
        published: nextPublished,
        published_at: nextPublished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }
      if (postId) {
        const { error } = await supabase.from('blog_posts').update(row as never).eq('id', postId)
        if (error) throw error
        setPublished(nextPublished)
        setMsg('saved')
      } else {
        const { data, error } = await supabase.from('blog_posts')
          .insert([{ ...row, author_id: user.id }] as never).select().single()
        if (error) throw error
        router.replace(`/admin/blog/${(data as BlogPost).id}`)
      }
    } catch (err) {
      console.error('[admin]', err)
      setMsg('failed')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{a.loading}</p>

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className={`font-pixel text-[9px] tracking-widest px-2 py-1 border ${
          published ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-700 text-gray-500'
        }`}>
          {published ? a.published : a.draft}
        </span>
        {msg === 'saved' && <span className="text-[#00ff41] text-xs">{a.saved}</span>}
        {msg === 'failed' && <span className="text-red-400 text-xs">{a.saveFailed}</span>}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.postTitle} className={inputClass} />
      <div className="flex gap-3 flex-wrap">
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">{a.noCategory}</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-3 cursor-pointer border border-gray-700 px-4 text-xs text-gray-400 hover:border-gray-500">
          {a.postThumb}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={uploadThumb} className="hidden" />
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="h-10 w-16 object-cover border border-gray-800" />
          )}
        </label>
      </div>
      <RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} />
      <div className="flex gap-3">
        <button
          onClick={() => save(published)}
          disabled={saving}
          className="font-pixel text-[10px] tracking-widest border border-gray-600 text-gray-300 px-6 py-3 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors disabled:opacity-50"
        >
          {a.save}
        </button>
        <button
          onClick={() => save(!published)}
          disabled={saving}
          className="font-pixel text-[10px] tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50"
        >
          {published ? a.unpublishToggle : a.publishToggle}
        </button>
      </div>
    </div>
  )
}
