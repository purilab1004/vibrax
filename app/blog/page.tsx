import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

// 블로그 목록 — 서버 렌더 + 캐시. 에디토리얼(매거진) 레이아웃: 밝은 배경 · 명확한 타이포 · 대표 1 + 서브 2 + 목록(페이지네이션)
export const revalidate = 120
const PAGE = 12

const getBlogData = unstable_cache(
  async () => {
    const sb = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const [{ data: cats }, { data: posts }] = await Promise.all([
      sb.from('blog_categories').select('*').order('sort_order'),
      sb.from('blog_posts').select('id, category_id, title, thumbnail_url, excerpt, published_at, view_count').eq('published', true).order('published_at', { ascending: false }),
    ])
    return { cats: (cats ?? []) as BlogCategory[], posts: (posts ?? []) as Pick<BlogPost, 'id' | 'category_id' | 'title' | 'thumbnail_url' | 'excerpt' | 'published_at' | 'view_count'>[] }
  },
  ['blog-page'], { revalidate: 120 },
)

const fmtDate = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }
const readMin = (t?: string | null) => Math.max(1, Math.round(((t ?? '').length + 400) / 500))
const CAT_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0891b2']

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string }> }) {
  const { cat, page: pageQ } = await searchParams
  const { cats, posts: all } = await getBlogData()
  const posts = cat ? all.filter(p => p.category_id === cat) : all
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? 'JOURNAL'
  const catColor = (id: string | null) => CAT_COLORS[Math.max(0, cats.findIndex(c => c.id === id)) % CAT_COLORS.length]
  const page = Math.max(1, parseInt(pageQ ?? '1', 10) || 1)
  const first = page === 1
  // 1페이지: 대표 1 + 서브 2 + 목록 / 2페이지~: 목록만
  const featured = first ? posts[0] ?? null : null
  const subs = first ? posts.slice(1, 3) : []
  const listAll = first ? posts.slice(3) : posts.slice(3)
  const totalPages = Math.max(1, Math.ceil(listAll.length / PAGE))
  const list = listAll.slice((page - 1) * PAGE, page * PAGE)
  const href = (p: number) => `/blog?${cat ? `cat=${cat}&` : ''}page=${p}`.replace(/&?page=1$/, '') || '/blog'

  const Thumb = ({ url, id, className }: { url: string | null; id: string | null; className: string }) => (
    <div className={`${className.includes('absolute') ? '' : 'relative '}overflow-hidden bg-[#15131c] ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${catColor(id)}22, ${catColor(id)}55)` }}>
          <span className="absolute left-4 bottom-3 text-[12px] font-extrabold tracking-tight" style={{ color: catColor(id) }}>vibrexcup</span>
        </div>
      )}
    </div>
  )
  const Meta = ({ p, light = false }: { p: typeof posts[number]; light?: boolean }) => (
    <p className={`text-[12px] ${light ? 'text-white/60' : 'text-white/45'}`}>{fmtDate(p.published_at)} · {readMin(p.excerpt)}분 읽기 · 조회 {(p.view_count ?? 0).toLocaleString()}</p>
  )
  const CatTag = ({ id }: { id: string | null }) => <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide uppercase" style={{ color: catColor(id) }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor(id) }} />{catName(id)}</span>

  return (
    <div className="relative min-h-screen bg-[#07060b] text-white overflow-hidden">
      {/* 배경 오라 */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,45,110,0.24),transparent)]" />
        <div className="absolute top-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.26),transparent)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12 space-y-5 md:space-y-8">
        {/* 헤더 */}
        <section className="rounded-3xl bg-white/[0.05] border border-white/10 p-5 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ff2d55]/15 border border-[#ff2d55]/40 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-[#ff8aa6]"><span className="w-2 h-2 rounded-full bg-[#ff2d55]" />VIBREX JOURNAL</span>
              <h1 className="mt-4 text-[34px] md:text-[48px] font-black tracking-tight leading-[1.05]"><span className="bg-gradient-to-r from-[#ffd24d] via-[#ff8a5c] to-[#ff2d6f] bg-clip-text text-transparent">블로그</span></h1>
              <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-xl leading-relaxed">새 게임 출시 노트, 제작 뒷이야기, 프롬프트 팁, 토너먼트 소식. 글의 절반은 AI 게임 기업가 AJ가 씁니다.</p>
            </div>
            <Link href="/notices" className="self-start md:self-auto inline-flex items-center h-10 px-4 rounded-full bg-white/[0.07] border border-white/15 text-[13px] font-bold text-white/85 hover:bg-white/[0.12] transition-colors">공지사항 →</Link>
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto no-scrollbar" aria-label="카테고리">
            {[{ id: '', name: '전체', n: all.length }, ...cats.map(c => ({ id: c.id, name: c.name, n: all.filter(p => p.category_id === c.id).length }))].map(c => {
              const active = (cat ?? '') === c.id
              return (
                <Link key={c.id || 'all'} href={c.id ? `/blog?cat=${c.id}` : '/blog'} className={`shrink-0 inline-flex items-center gap-1.5 h-10 pl-4 pr-2 rounded-full text-[13.5px] font-bold transition-all ${active ? 'bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-white shadow-[0_6px_16px_-6px_rgba(255,45,111,0.7)]' : 'bg-white/[0.06] border border-white/10 text-white/60 hover:text-white'}`}>
                  {c.name}<span className={`text-[11px] font-bold tabular-nums rounded-full px-1.5 py-0.5 ${active ? 'bg-white/25 text-white' : 'bg-white/10 text-white/55'}`}>{c.n}</span>
                </Link>
              )
            })}
          </nav>
        </section>

        {posts.length === 0 ? <p className="text-white/45 text-[15px] py-24 text-center">아직 글이 없습니다.</p> : (
          <>
            {featured && (
              <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
                {/* 대표 */}
                <Link href={`/blog/${featured.id}`} className="group relative block rounded-3xl overflow-hidden bg-[#15131c] border border-white/10 min-h-[300px] md:min-h-[380px] lg:min-h-0">
                  <Thumb url={featured.thumbnail_url} id={featured.category_id} className="absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: catColor(featured.category_id) }}>{catName(featured.category_id)}</span>
                    <h2 className="mt-3 text-[23px] md:text-[32px] font-extrabold leading-[1.2] tracking-tight max-w-2xl group-hover:underline decoration-2 underline-offset-4">{featured.title}</h2>
                    {featured.excerpt && <p className="mt-2 text-[14px] text-white/70 leading-relaxed line-clamp-2 max-w-2xl">{featured.excerpt}</p>}
                    <div className="mt-3"><Meta p={featured} light /></div>
                  </div>
                </Link>
                {/* 서브 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {subs.map(p => (
                    <Link key={p.id} href={`/blog/${p.id}`} className="group flex flex-col rounded-3xl overflow-hidden bg-white/[0.05] border border-white/10 hover:border-white/25 hover:shadow-[0_18px_40px_-24px_rgba(255,45,111,0.5)] transition-all">
                      <Thumb url={p.thumbnail_url} id={p.category_id} className="aspect-[16/9]" />
                      <div className="p-4 flex flex-col gap-2">
                        <CatTag id={p.category_id} />
                        <h3 className="text-[16px] font-bold leading-snug group-hover:text-[#ff8aa6] transition-colors line-clamp-2">{p.title}</h3>
                        <Meta p={p} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 목록 */}
            {list.length > 0 && (
              <section className="rounded-3xl bg-white/[0.05] border border-white/10 p-4 md:p-6">
                <div className="flex items-center justify-between pb-2">
                  <h2 className="text-[18px] font-extrabold">{first ? '최신 글' : `글 목록 · ${page} / ${totalPages}`}</h2>
                  <span className="text-[12px] text-white/45">{listAll.length}개</span>
                </div>
                <ul className="divide-y divide-white/10">
                  {list.map(p => (
                    <li key={p.id}>
                      <Link href={`/blog/${p.id}`} className="group grid grid-cols-[1fr_96px] sm:grid-cols-[1fr_160px] gap-4 sm:gap-6 py-4 items-center">
                        <div className="min-w-0">
                          <CatTag id={p.category_id} />
                          <h3 className="mt-1.5 text-[16px] md:text-[19px] font-bold leading-snug tracking-tight group-hover:text-[#ff8aa6] transition-colors line-clamp-2">{p.title}</h3>
                          {p.excerpt && <p className="mt-1.5 hidden sm:block text-[14px] text-white/55 leading-relaxed line-clamp-2">{p.excerpt}</p>}
                          <div className="mt-2"><Meta p={p} /></div>
                        </div>
                        <Thumb url={p.thumbnail_url} id={p.category_id} className="aspect-[4/3] sm:aspect-[16/10] rounded-2xl border border-white/10" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="페이지">
                    <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={`h-10 px-4 inline-flex items-center rounded-full text-[13px] font-bold ${page <= 1 ? 'pointer-events-none opacity-30 bg-white/[0.05] text-white/50' : 'bg-white/[0.07] border border-white/15 text-white hover:bg-white/[0.12]'}`}>이전</Link>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2).reduce<(number | '…')[]>((a, n) => { const prev = a[a.length - 1]; if (typeof prev === 'number' && n - prev > 1) a.push('…'); a.push(n); return a }, []).map((n, i) => n === '…' ? <span key={`e${i}`} className="px-1 text-white/40">…</span> : (
                      <Link key={n} href={href(n)} className={`h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${n === page ? 'bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-white' : 'text-white/60 hover:bg-white/[0.08]'}`}>{n}</Link>
                    ))}
                    <Link aria-disabled={page >= totalPages} href={href(Math.min(totalPages, page + 1))} className={`h-10 px-4 inline-flex items-center rounded-full text-[13px] font-bold ${page >= totalPages ? 'pointer-events-none opacity-30 bg-white/[0.05] text-white/50' : 'bg-white/[0.07] border border-white/15 text-white hover:bg-white/[0.12]'}`}>다음</Link>
                  </nav>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
