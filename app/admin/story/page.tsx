'use client'
// STORY 관리 — 게임별 연재 회차 목록 · 상태 필터 · 연재 점검(새 지도·몬스터 감지) · 삭제 확인
import AutoPanel from '@/components/admin/AutoPanel'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogPost } from '@/lib/supabase/types'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, ConfirmModal, Toast, Skeleton, EmptyState, Segmented, Pager, usePager, btn, input, th, td, trHover, IconAction } from '@/components/admin/ui'

type Row = BlogPost & { games: { title: string } | null; no: number }

export default function AdminStoryPage() {
  const [posts, setPosts] = useState<Row[] | null>(null)
  const [sweeping, setSweeping] = useState(false)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    supabase.from('blog_posts').select('*, games(title)').eq('source', 'story').order('created_at', { ascending: true }).then(({ data }) => {
      // 화 번호 = 같은 게임 안에서 만든 순서
      const seen: Record<string, number> = {}
      const rows = ((data ?? []) as Row[]).map(p => ({ ...p, no: (seen[p.game_id ?? ''] = (seen[p.game_id ?? ''] ?? 0) + 1) }))
      setPosts(rows.reverse())
    })
  }
  // 연재 점검 — 모든 게임의 새 지도·몬스터를 감지해 다음 화를 쓰고, 계획해 둔 회차를 한 화씩 연재(매일 자동으로도 돈다)
  const sweep = async () => {
    setSweeping(true)
    try {
      const r = await fetch('/api/cron/story').then(r => r.json()) as { results?: { action: string; episode?: string }[] }
      const made = (r.results ?? []).filter(x => x.episode).length
      setToast(made ? `새 회차 ${made}편을 만들었어요.` : '새로 쓸 회차가 없어요.'); setTimeout(() => setToast(null), 3000); load()
    } finally { setSweeping(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const remove = async () => {
    if (!deleting) return
    await supabase.from('blog_posts').delete().eq('id', deleting.id)
    setDeleting(null); setToast('삭제했어요.'); setTimeout(() => setToast(null), 2400); load()
  }
  const list = useMemo(() => (posts ?? []).filter(p => (filter === 'all' || (filter === 'published') === p.published) && (!query.trim() || `${p.title} ${p.games?.title ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [posts, filter, query])
  const pager = usePager(list, 25)
  const pub = (posts ?? []).filter(p => p.published).length
  const views = (posts ?? []).reduce((s, p) => s + (p.view_count ?? 0), 0)

  return (
    <div>
      <PageHeader title={a.blogHeading} desc="게임마다 연재되는 웹소설 회차. 첫 게시 때 1화, 새 지도·몬스터가 생기는 업데이트마다 다음 화가 자동으로 올라와요."
        actions={<><button onClick={sweep} disabled={sweeping} className={btn.ghost}>{sweeping ? '점검 중…' : '연재 점검'}</button><Link href="/admin/story/new" className={btn.primary}>새 회차</Link></>} />
      <AutoPanel module="blog" />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatCard label="전체 회차" value={posts?.length ?? '-'} />
        <StatCard label="발행됨" value={pub} accent="#059669" sub={`임시저장 ${(posts?.length ?? 0) - pub}`} />
        <StatCard label="총 조회수" value={views} accent="#7c3aed" />
      </div>
      <Card>
        <div className="flex items-center gap-3 flex-wrap p-3 border-b border-[#e3e6ec]">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="작품·회차 제목 검색" className={`${input} max-w-xs`} />
          <div className="ml-auto"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: '전체' }, { value: 'published', label: a.published }, { value: 'draft', label: a.draft }]} /></div>
        </div>
        {posts === null ? <Skeleton /> : list.length === 0 ? <EmptyState title={a.noPosts} action={<Link href="/admin/story/new" className={btn.primary}>새 회차</Link>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>회차</th><th className={th}>작품</th><th className={th}>상태</th><th className={`${th} text-right`}>조회</th><th className={th}>작성일</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-[#eef0f4]">
                {pager.slice.map(p => (
                  <tr key={p.id} className={trHover}>
                    <td className={td}>
                      <div className="flex items-center gap-3 min-w-[260px]">
                        <span className="w-14 h-10 rounded-md overflow-hidden bg-[#eef0f4] shrink-0 flex items-center justify-center text-[#b3a78f]">
                          {p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </span>
                        <Link href={`/admin/story/${p.id}`} className="font-semibold text-[#1f2430] hover:text-[#2563eb] truncate max-w-[380px]">{p.no}화 {p.title || '—'}</Link>
                      </div>
                    </td>
                    <td className={td}>{p.games?.title ?? '—'}</td>
                    <td className={td}>{p.published ? <Badge color="#059669">{a.published}</Badge> : <Badge color="#857a68">{a.draft}</Badge>}</td>
                    <td className={`${td} text-right tabular-nums`}>{(p.view_count ?? 0).toLocaleString()}</td>
                    <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className={td}>
                      <div className="flex gap-1.5 justify-end">
                        {p.published && <IconAction kind="external" label="사이트에서 보기" href={`/story/${p.id}`} external />}
                        <IconAction kind="edit" label={a.edit} href={`/admin/story/${p.id}`} />
                        <IconAction kind="delete" label={a.delete} onClick={() => setDeleting(p)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager {...pager} />
          </div>
        )}
      </Card>
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="회차 삭제" desc={<><b>{deleting?.title}</b> 을(를) 삭제할까요? 되돌릴 수 없어요.</>} />
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
