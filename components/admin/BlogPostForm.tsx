'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'
import { makeExcerpt } from '@/lib/blog/excerpt'
import Link from 'next/link'
import { PageHeader, Card, Badge, Toast, Skeleton, btn, input, label as labelCls } from '@/components/admin/ui'

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

  if (!loaded) return <Skeleton rows={6} />

  return (
    <div>
      <PageHeader title={postId ? '글 수정' : a.newPost}
        desc={<span className="inline-flex items-center gap-2"><Link href="/admin/blog" className="hover:text-[#2563eb]">← 블로그 관리</Link>{published ? <Badge color="#059669">{a.published}</Badge> : <Badge color="#857a68">{a.draft}</Badge>}</span>}
        actions={<>
          <button onClick={() => save(published)} disabled={saving} className={btn.ghost}>{a.save}</button>
          <button onClick={() => save(!published)} disabled={saving} className={published ? btn.ghost : btn.primary}>{published ? a.unpublishToggle : a.publishToggle}</button>
        </>} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <Card className="p-5 space-y-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.postTitle} className="w-full text-[22px] font-extrabold tracking-tight text-[#241f17] placeholder-[#c4b9a2] outline-none bg-transparent border-b border-[#ebe4d6] focus:border-[#2563eb] pb-2 transition-colors" />
          <RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} />
        </Card>
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <p className="text-[13px] font-bold text-[#241f17]">게시 설정</p>
            <div><label className={labelCls}>{a.postCategory}</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={input}>
                <option value="">{a.noCategory}</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className={labelCls}>{a.postThumb}</label>
              <label className="block cursor-pointer rounded-xl border border-dashed border-[#cfc4ab] hover:border-[#2563eb] bg-[#faf8f3] overflow-hidden transition-colors">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="" className="w-full aspect-video object-cover" />
                ) : <div className="aspect-video flex flex-col items-center justify-center text-[#9d9280] text-[12.5px]"><span className="text-2xl mb-1">🖼</span>클릭해서 업로드</div>}
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={uploadThumb} className="hidden" />
              </label>
              {thumbnailUrl && <button onClick={() => setThumbnailUrl(null)} className="mt-1.5 text-[11.5px] text-[#9d9280] hover:text-[#e11d48]">썸네일 제거</button>}
            </div>
          </Card>
          {postId && <Card className="p-5 text-[12px] text-[#857a68]"><p>글 ID · <span className="font-mono text-[11px]">{postId}</span></p>{published && <a href={`/blog/${postId}`} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[#2563eb] hover:underline">공개 페이지 보기 →</a>}</Card>}
        </div>
      </div>
      <Toast msg={msg === 'saved' ? a.saved : msg === 'failed' ? a.saveFailed : null} kind={msg === 'failed' ? 'err' : 'ok'} />
    </div>
  )
}
