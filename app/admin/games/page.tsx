'use client'
// 게임 관리 — 검색 · 정렬 · 장르 필터 · 편집 모달 · 삭제 확인 · AJ 링크
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Genre, GameWithCreator } from '@/lib/supabase/types'
import StatCard from '@/components/admin/StatCard'
import { COUNTRIES } from '@/lib/countries'
import { countryFlag } from '@/lib/country'
import { PageHeader, Card, Badge, Modal, ConfirmModal, Toast, Skeleton, EmptyState, Segmented, Pager, usePager, btn, input, label as labelCls, th, td, trHover } from '@/components/admin/ui'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']
const GENRE_COLOR: Record<string, string> = { action: '#e11d48', adventure: '#059669', strategy: '#7c3aed', sports: '#f59e0b' }

export default function AdminGamesPage() {
  const [games, setGames] = useState<GameWithCreator[] | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'views'>('newest')
  const [genre, setGenre] = useState<Genre | 'all'>('all')
  const [editing, setEditing] = useState<GameWithCreator | null>(null)
  const [form, setForm] = useState({ title: '', genre: 'action' as Genre, coin_cost: 1, teaser: '', country: '' })
  const [deleting, setDeleting] = useState<GameWithCreator | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin
  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600) }

  const load = () => {
    let q = supabase.from('games').select('*, profiles(username, agent_name, avatar_config)')
    if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
    q = sort === 'views' ? q.order('view_count', { ascending: false }) : q.order('created_at', { ascending: false })
    q.limit(300).then(({ data }) => setGames((data as unknown as GameWithCreator[] | null) ?? []))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [sort])

  const list = useMemo(() => (games ?? []).filter(g => genre === 'all' || g.genre === genre), [games, genre])
  const totalViews = useMemo(() => (games ?? []).reduce((s, g) => s + (g.view_count ?? 0), 0), [games])
  const [weekAgo] = useState(() => Date.now() - 7 * 864e5)
  const pager = usePager(list, 25)

  const openEdit = (g: GameWithCreator) => { setEditing(g); setForm({ title: g.title, genre: g.genre, coin_cost: g.coin_cost ?? 1, teaser: g.teaser ?? '', country: g.country ?? '' }) }
  const saveEdit = async () => {
    if (!editing) return
    setBusy(true)
    const { error } = await supabase.from('games').update({ title: form.title.trim(), genre: form.genre, coin_cost: Math.max(0, form.coin_cost | 0), teaser: form.teaser.trim() || null, country: form.country || null } as never).eq('id', editing.id)
    setBusy(false)
    if (error) { console.error('[admin]', error); say(a.actionFailed, 'err'); return }
    say(a.saved); setEditing(null); load()
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    const { error } = await supabase.from('games').delete().eq('id', deleting.id)
    setBusy(false)
    if (error) { console.error('[admin]', error); say(a.actionFailed, 'err'); return }
    say('삭제했어요.'); setDeleting(null); load()
  }

  return (
    <div>
      <PageHeader title={a.gamesHeading} desc="게시된 게임을 검색·수정·삭제하고 AJ 대시보드로 이동할 수 있어요."
        actions={<Link href="/submit" className={btn.primary}>게임 등록</Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="게시된 게임" value={games?.length ?? '-'} />
        <StatCard label="총 조회수" value={totalViews} accent="#7c3aed" />
        <StatCard label="최근 7일 등록" value={(games ?? []).filter(g => new Date(g.created_at).getTime() > weekAgo).length} accent="#059669" />
        <StatCard label="스튜디오 제작" value={(games ?? []).filter(g => g.studio_project_id).length} sub="AI 스튜디오로 만든 게임" accent="#0891b2" />
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap p-3 border-b border-[#e3e6ec]">
          <form onSubmit={e => { e.preventDefault(); load() }} className="relative flex-1 min-w-[220px] max-w-sm">
            <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1957f]" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={a.searchGames} className={`${input} pl-9`} />
          </form>
          <Segmented value={genre} onChange={setGenre} options={[{ value: 'all', label: '전체' }, ...GENRES.map(g => ({ value: g, label: T.genres[g] }))]} />
          <div className="ml-auto"><Segmented value={sort} onChange={setSort} options={[{ value: 'newest', label: a.sortNewest }, { value: 'views', label: a.sortViews }]} /></div>
        </div>
        {games === null ? <Skeleton /> : list.length === 0 ? <EmptyState title="게임이 없어요" desc="검색어나 필터를 바꿔 보세요." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={th}>{a.colGame}</th><th className={th}>제작자</th><th className={th}>{a.colGenre}</th><th className={`${th} text-right`}>{a.colViews}</th><th className={`${th} text-right`}>코인</th><th className={th}>{a.colCreated}</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-[#eef0f4]">
                {pager.slice.map(g => (
                  <tr key={g.id} className={trHover}>
                    <td className={td}>
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <span className="relative w-16 h-10 rounded-md overflow-hidden bg-gray-900 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`/games/${g.id}`} className="block font-semibold text-[#1f2430] hover:text-[#2563eb] truncate max-w-[320px]">{g.title}</Link>
                          <p className="text-[11.5px] text-[#9aa1ad] truncate max-w-[320px]">{g.studio_project_id ? '스튜디오' : '업로드'}{g.teaser ? ` · ${g.teaser}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className={td}><span className="text-[#374151]">{countryFlag(g.country ?? g.profiles?.country)} {g.profiles?.agent_name ?? g.profiles?.username ?? '-'}</span></td>
                    <td className={td}><Badge color={GENRE_COLOR[g.genre] ?? '#2563eb'}>{T.genres[g.genre]}</Badge></td>
                    <td className={`${td} text-right tabular-nums font-semibold text-[#1f2430]`}>{(g.view_count ?? 0).toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums`}>{g.coin_cost ?? 1}</td>
                    <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(g.created_at).toLocaleDateString()}</td>
                    <td className={td}>
                      <div className="flex gap-1.5 justify-end">
                        <Link href={`/aj/${g.id}`} className={btn.ghost + ' !h-8 !px-2.5'}>AJ</Link>
                        <button onClick={() => openEdit(g)} className={btn.ghost + ' !h-8 !px-2.5'}>{a.edit}</button>
                        <button onClick={() => setDeleting(g)} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#e3e6ec] text-[12.5px] font-medium text-[#6b7280] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">{a.delete}</button>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title="게임 수정">
        {editing && (
          <div className="space-y-4">
            <div><label className={labelCls}>제목</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={input} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>장르</label><select value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value as Genre })} className={input}>{GENRES.map(x => <option key={x} value={x}>{T.genres[x]}</option>)}</select></div>
              <div><label className={labelCls}>플레이 코인</label><input type="number" min={0} value={form.coin_cost} onChange={e => setForm({ ...form, coin_cost: Number(e.target.value) })} className={input} /></div>
            </div>
            <div><label className={labelCls}>게임 국가</label><select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={input}><option value="">선택 안 함</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select></div>
            <div><label className={labelCls}>티저 문구 (카드 훅)</label><input value={form.teaser} onChange={e => setForm({ ...form, teaser: e.target.value })} className={input} placeholder="비우면 자동 문구" /></div>
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setEditing(null)} className={btn.ghost}>{a.cancel}</button><button onClick={saveEdit} disabled={busy || !form.title.trim()} className={btn.primary}>{a.save}</button></div>
          </div>
        )}
      </Modal>
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} busy={busy} title="게임 삭제"
        desc={<><b>{deleting?.title}</b> 을(를) 삭제해요. 플레이 기록·좋아요·AJ 리포트도 함께 사라지고 되돌릴 수 없어요.</>} />
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}
