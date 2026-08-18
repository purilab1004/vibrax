'use client'
// 블로그 관리 — 카테고리 · 상태 필터 · 글 목록(썸네일/조회수) · 삭제 확인
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import CategoryManager from '@/components/admin/CategoryManager'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, ConfirmModal, Toast, Skeleton, EmptyState, Segmented, btn, input, th, td, trHover } from '@/components/admin/ui'

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<BlogPost | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    supabase.from('blog_posts').select('*').order('created_at', { ascending: false }).then(({ data }) => setPosts((data as BlogPost[] | null) ?? []))
    supabase.from('blog_categories').select('*').then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const remove = async () => {
    if (!deleting) return
    await supabase.from('blog_posts').delete().eq('id', deleting.id)
    setDeleting(null); setToast('삭제했어요.'); setTimeout(() => setToast(null), 2400); load()
  }
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? '—'
  const list = useMemo(() => (posts ?? []).filter(p => (filter === 'all' || (filter === 'published') === p.published) && (!query.trim() || p.title.toLowerCase().includes(query.trim().toLowerCase()))), [posts, filter, query])
  const pub = (posts ?? []).filter(p => p.published).length
  const views = (posts ?? []).reduce((s, p) => s + (p.view_count ?? 0), 0)

  return (
    <div>
      <PageHeader title={a.blogHeading} desc="글을 작성·발행하고 카테고리를 관리해요."
        actions={<Link href="/admin/blog/new" className={btn.primary}>✎ {a.newPost}</Link>} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="전체 글" value={posts?.length ?? '-'} />
        <StatCard label="발행됨" value={pub} accent="#059669" sub={`임시저장 ${(posts?.length ?? 0) - pub}`} />
        <StatCard label="총 조회수" value={views} accent="#7c3aed" />
      </div>
      <div className="mb-4"><CategoryManager onChanged={load} /></div>
      <Card>
        <div className="flex items-center gap-3 flex-wrap p-4 border-b border-[#ebe4d6]">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목 검색" className={`${input} max-w-xs`} />
          <div className="ml-auto"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: '전체' }, { value: 'published', label: a.published }, { value: 'draft', label: a.draft }]} /></div>
        </div>
        {posts === null ? <Skeleton /> : list.length === 0 ? <EmptyState icon="📝" title={a.noPosts} action={<Link href="/admin/blog/new" className={btn.primary}>{a.newPost}</Link>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>글</th><th className={th}>카테고리</th><th className={th}>상태</th><th className={`${th} text-right`}>조회</th><th className={th}>작성일</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-[#f0eadf]">
                {list.map(p => (
                  <tr key={p.id} className={trHover}>
                    <td className={td}>
                      <div className="flex items-center gap-3 min-w-[260px]">
                        <span className="w-14 h-10 rounded-md overflow-hidden bg-[#f1ece2] shrink-0 flex items-center justify-center text-[#b3a78f]">
                          {p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : '📄'}
                        </span>
                        <Link href={`/admin/blog/${p.id}`} className="font-semibold text-[#241f17] hover:text-[#2563eb] truncate max-w-[380px]">{p.title || '—'}</Link>
                      </div>
                    </td>
                    <td className={td}>{catName(p.category_id)}</td>
                    <td className={td}>{p.published ? <Badge color="#059669">{a.published}</Badge> : <Badge color="#857a68">{a.draft}</Badge>}</td>
                    <td className={`${td} text-right tabular-nums`}>{(p.view_count ?? 0).toLocaleString()}</td>
                    <td className={`${td} whitespace-nowrap text-[#857a68]`}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className={td}>
                      <div className="flex gap-1.5 justify-end">
                        {p.published && <a href={`/blog/${p.id}`} target="_blank" rel="noreferrer" className={btn.ghost + ' !h-8 !px-2.5'}>보기</a>}
                        <Link href={`/admin/blog/${p.id}`} className={btn.ghost + ' !h-8 !px-2.5'}>{a.edit}</Link>
                        <button onClick={() => setDeleting(p)} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#ebe4d6] text-[12.5px] font-medium text-[#857a68] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">{a.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="글 삭제" desc={<><b>{deleting?.title}</b> 을(를) 삭제할까요? 되돌릴 수 없어요.</>} />
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
