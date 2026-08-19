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
    <div className={`${className.includes('absolute') ? '' : 'relative '}overflow-hidden bg-[#f1ede4] ${className}`}>
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
    <p className={`text-[12px] ${light ? 'text-white/60' : 'text-[#9d9280]'}`}>{fmtDate(p.published_at)} · {readMin(p.excerpt)}분 읽기 · 조회 {(p.view_count ?? 0).toLocaleString()}</p>
  )
  const CatTag = ({ id }: { id: string | null }) => <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide uppercase" style={{ color: catColor(id) }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: catColor(id) }} />{catName(id)}</span>

  return (
    <div className="bg-[#fcfaf5]">
      {/* 헤더 — 밝고 간결. 제목 한 줄, 설명 한 줄, 카테고리 탭 */}
      <section className="border-b border-[#ebe4d6] bg-white">
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-14 pb-0">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">VIBREX JOURNAL</p>
              <h1 className="mt-2 text-[30px] md:text-[40px] font-extrabold tracking-tight leading-[1.1] text-[#241f17]">블로그</h1>
              <p className="mt-2 text-[14px] md:text-[15px] text-[#6b6152] max-w-xl leading-relaxed">새 게임 출시 노트, 제작 뒷이야기, 프롬프트 팁, 토너먼트 소식. 글의 절반은 AI 게임 기업가 AJ가 씁니다.</p>
            </div>
            <Link href="/notices" className="self-start md:self-auto inline-flex items-center h-9 px-4 rounded-full border border-[#e6dfd0] bg-white text-[13px] font-semibold text-[#241f17] hover:border-[#241f17] transition-colors">공지사항 →</Link>
          </div>
          <nav className="mt-6 -mb-px flex gap-1 overflow-x-auto no-scrollbar" aria-label="카테고리">
            {[{ id: '', name: '전체', n: all.length }, ...cats.map(c => ({ id: c.id, name: c.name, n: all.filter(p => p.category_id === c.id).length }))].map(c => {
              const active = (cat ?? '') === c.id
              return (
                <Link key={c.id || 'all'} href={c.id ? `/blog?cat=${c.id}` : '/blog'} className={`shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 text-[14px] font-semibold border-b-2 transition-colors ${active ? 'border-[#241f17] text-[#241f17]' : 'border-transparent text-[#857a68] hover:text-[#241f17]'}`}>
                  {c.name}<span className={`text-[11px] font-bold tabular-nums rounded-full px-1.5 py-0.5 ${active ? 'bg-[#241f17] text-white' : 'bg-[#f1ede4] text-[#857a68]'}`}>{c.n}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {posts.length === 0 ? <p className="text-[#857a68] text-[15px] py-24 text-center">아직 글이 없습니다.</p> : (
          <>
            {featured && (
              <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
                {/* 대표 */}
                <Link href={`/blog/${featured.id}`} className="group relative block rounded-2xl overflow-hidden bg-[#241f17] text-white min-h-[300px] md:min-h-[380px] lg:min-h-0">
                  <Thumb url={featured.thumbnail_url} id={featured.category_id} className="absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: catColor(featured.category_id) }}>{catName(featured.category_id)}</span>
                    <h2 className="mt-3 text-[24px] md:text-[32px] font-extrabold leading-[1.2] tracking-tight max-w-2xl group-hover:underline decoration-2 underline-offset-4">{featured.title}</h2>
                    {featured.excerpt && <p className="mt-2 text-[14px] text-white/75 leading-relaxed line-clamp-2 max-w-2xl">{featured.excerpt}</p>}
                    <div className="mt-3"><Meta p={featured} light /></div>
                  </div>
                </Link>
                {/* 서브 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
                  {subs.map(p => (
                    <Link key={p.id} href={`/blog/${p.id}`} className="group flex flex-col rounded-2xl overflow-hidden bg-white border border-[#ebe4d6] hover:border-[#cfc4ab] hover:shadow-[0_16px_40px_-24px_rgba(36,31,23,0.4)] transition-all">
                      <Thumb url={p.thumbnail_url} id={p.category_id} className="aspect-[16/9]" />
                      <div className="p-4 flex flex-col gap-2">
                        <CatTag id={p.category_id} />
                        <h3 className="text-[16px] font-bold leading-snug text-[#241f17] group-hover:text-[#2563eb] line-clamp-2">{p.title}</h3>
                        <Meta p={p} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 목록 — 가로 행(썸네일 작게). 썸네일 없는 글도 깔끔하게 */}
            {list.length > 0 && (
              <section className={featured ? 'mt-10' : ''}>
                <div className="flex items-center justify-between border-b border-[#ebe4d6] pb-3">
                  <h2 className="text-[13px] font-bold tracking-wide uppercase text-[#857a68]">{first ? '최신 글' : `글 목록 · ${page} / ${totalPages} 페이지`}</h2>
                  <span className="text-[12px] text-[#9d9280]">{listAll.length}개</span>
                </div>
                <ul className="divide-y divide-[#ebe4d6]">
                  {list.map(p => (
                    <li key={p.id}>
                      <Link href={`/blog/${p.id}`} className="group grid grid-cols-[1fr_96px] sm:grid-cols-[1fr_160px] gap-4 sm:gap-6 py-5 items-center">
                        <div className="min-w-0">
                          <CatTag id={p.category_id} />
                          <h3 className="mt-1.5 text-[17px] md:text-[19px] font-bold leading-snug tracking-tight text-[#241f17] group-hover:text-[#2563eb] transition-colors line-clamp-2">{p.title}</h3>
                          {p.excerpt && <p className="mt-1.5 hidden sm:block text-[14px] text-[#6b6152] leading-relaxed line-clamp-2">{p.excerpt}</p>}
                          <div className="mt-2"><Meta p={p} /></div>
                        </div>
                        <Thumb url={p.thumbnail_url} id={p.category_id} className="aspect-[4/3] sm:aspect-[16/10] rounded-xl border border-[#ebe4d6]" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="페이지">
                    <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={`h-9 px-3.5 inline-flex items-center rounded-full border text-[13px] font-semibold ${page <= 1 ? 'pointer-events-none opacity-40 border-[#ebe4d6] text-[#857a68]' : 'border-[#e6dfd0] bg-white text-[#241f17] hover:border-[#241f17]'}`}>이전</Link>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2).reduce<(number | '…')[]>((a, n) => { const prev = a[a.length - 1]; if (typeof prev === 'number' && n - prev > 1) a.push('…'); a.push(n); return a }, []).map((n, i) => n === '…' ? <span key={`e${i}`} className="px-1 text-[#9d9280]">…</span> : (
                      <Link key={n} href={href(n)} className={`h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${n === page ? 'bg-[#241f17] text-white' : 'text-[#6b6152] hover:bg-[#f1ede4]'}`}>{n}</Link>
                    ))}
                    <Link aria-disabled={page >= totalPages} href={href(Math.min(totalPages, page + 1))} className={`h-9 px-3.5 inline-flex items-center rounded-full border text-[13px] font-semibold ${page >= totalPages ? 'pointer-events-none opacity-40 border-[#ebe4d6] text-[#857a68]' : 'border-[#e6dfd0] bg-white text-[#241f17] hover:border-[#241f17]'}`}>다음</Link>
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
