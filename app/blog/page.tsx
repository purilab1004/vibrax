import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

// 블로그(저널) 목록 — 서버 렌더 + 캐시.
// 레이아웃: 헤더(검색·카테고리) · 대표 기사 1 + 최신 2 · 인기 TOP 5 레일 · 카드 그리드 + 페이지네이션
export const revalidate = 120
const PAGE = 9

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

type Post = Awaited<ReturnType<typeof getBlogData>>['posts'][number]

const fmtDate = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }
const readMin = (t?: string | null) => Math.max(1, Math.round(((t ?? '').length + 400) / 500))
const CAT_COLORS = ['#ff2d6f', '#8b3dff', '#0ea5e9', '#f59e0b', '#22c55e', '#e11d48']


// 썸네일 — 없으면 카테고리 색 그라디언트 + 제목 첫 글자
function Thumb({ p, color, className = '', fill = false }: { p: Post; color: string; className?: string; fill?: boolean }) {
  return (
    <div className={`${fill ? 'absolute inset-0' : 'relative'} overflow-hidden bg-[#141019] ${className}`}>
      {p.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
      ) : (
        <div className="absolute inset-0 grid place-items-center" style={{ background: `radial-gradient(120% 120% at 20% 0%, ${color}55, transparent 60%), linear-gradient(140deg, #1b1522, #120f18)` }}>
          <span className="text-[44px] font-black text-white/15">{p.title.charAt(0)}</span>
        </div>
      )}
    </div>
  )
}

function CatTag({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.12em] uppercase" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{name}
    </span>
  )
}

function Meta({ p }: { p: Post }) {
  return <p className="text-[11.5px] text-white/40 tabular-nums">{fmtDate(p.published_at)} · {readMin(p.excerpt)}분 · {(p.view_count ?? 0).toLocaleString()} 읽음</p>
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string; q?: string }> }) {
  const { cat, page: pageQ, q: qRaw } = await searchParams
  const q = (qRaw ?? '').trim()
  const { cats, posts: all } = await getBlogData()
  const filtered = all
    .filter(p => (cat ? p.category_id === cat : true))
    .filter(p => (q ? `${p.title} ${p.excerpt ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true))
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? 'JOURNAL'
  const catColor = (id: string | null) => CAT_COLORS[Math.max(0, cats.findIndex(c => c.id === id)) % CAT_COLORS.length]
  const page = Math.max(1, parseInt(pageQ ?? '1', 10) || 1)
  const plain = !cat && !q            // 필터 없는 첫 화면에서만 대표·인기 구성
  const first = page === 1 && plain
  const featured = first ? filtered[0] ?? null : null
  const subs = first ? filtered.slice(1, 3) : []
  const popular = first ? [...all].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 5) : []
  const rest = first ? filtered.slice(3) : filtered
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE))
  const list = rest.slice((page - 1) * PAGE, page * PAGE)
  const qs = (o: { cat?: string | null; page?: number; q?: string }) => {
    const s = new URLSearchParams()
    const c = o.cat === undefined ? cat : o.cat
    if (c) s.set('cat', c)
    if (o.q ?? q) s.set('q', o.q ?? q)
    if (o.page && o.page > 1) s.set('page', String(o.page))
    const t = s.toString()
    return t ? `/blog?${t}` : '/blog'
  }

  return (
    <div className="relative min-h-screen bg-[#08070d] text-white">
      {/* 배경 오라 */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] pointer-events-none overflow-hidden">
        <div className="absolute -top-44 -left-28 w-[30rem] h-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,45,110,0.22),transparent)]" />
        <div className="absolute -top-24 right-[-8rem] w-[32rem] h-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.24),transparent)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-7 md:pt-12 pb-16 md:pb-24">
        {/* ── 매스트헤드 ── */}
        <header className="border-b border-white/10 pb-5 md:pb-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-[10.5px] font-extrabold tracking-[0.34em] text-[#ff8aa6]"><span className="w-1.5 h-1.5 rounded-full bg-[#ff2d55]" />VIBREX JOURNAL</span>
              <h1 className="mt-2.5 text-[38px] md:text-[62px] font-black tracking-[-0.03em] leading-[0.95]">
                저널<span className="text-[#ff2d6f]">.</span>
              </h1>
              <p className="mt-2.5 text-[13.5px] md:text-[15px] text-white/50 leading-relaxed max-w-lg">출시 노트 · 제작 뒷이야기 · 프롬프트 팁 · 토너먼트 소식. 글의 절반은 AI 게임 기업가 <span className="text-white/75 font-semibold">AJ</span>가 씁니다.</p>
            </div>
            <Link href="/notices" className="hidden sm:inline-flex shrink-0 items-center h-9 px-4 rounded-full border border-white/15 text-[12.5px] font-bold text-white/70 hover:text-white hover:border-white/35 transition-colors">공지사항 →</Link>
          </div>

          {/* 검색 — JS 없이 GET */}
          <form action="/blog" className="mt-5 flex gap-2">
            {cat && <input type="hidden" name="cat" value={cat} />}
            <label className="flex-1 flex items-center gap-2 h-11 rounded-full bg-white/[0.06] border border-white/12 px-4 focus-within:border-white/30 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" strokeLinecap="round" /></svg>
              <input name="q" defaultValue={q} placeholder="글 검색 — 프롬프트, 3D, 토너먼트…" className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-white/30" />
            </label>
            <button className="h-11 px-5 rounded-full bg-white text-[#0b0910] text-[13.5px] font-extrabold hover:bg-white/85 transition-colors">검색</button>
          </form>

          {/* 카테고리 — 밑줄형 */}
          <nav className="mt-4 -mb-px flex gap-5 overflow-x-auto no-scrollbar" aria-label="카테고리">
            {[{ id: '', name: '전체', n: all.length }, ...cats.map(c => ({ id: c.id, name: c.name, n: all.filter(p => p.category_id === c.id).length }))].map(c => {
              const active = (cat ?? '') === c.id
              return (
                <Link key={c.id || 'all'} href={qs({ cat: c.id || null, page: 1 })} className={`shrink-0 pb-3 text-[14px] font-bold border-b-2 transition-colors ${active ? 'text-white border-[#ff2d6f]' : 'text-white/45 border-transparent hover:text-white/80'}`}>
                  {c.name}<span className="ml-1.5 text-[11px] font-bold tabular-nums text-white/30">{c.n}</span>
                </Link>
              )
            })}
          </nav>
        </header>

        {q && <p className="mt-5 text-[13.5px] text-white/50">‘<span className="text-white font-semibold">{q}</span>’ 검색 결과 <span className="tabular-nums text-white">{filtered.length}</span>건</p>}

        {filtered.length === 0 ? (
          <p className="text-white/40 text-[15px] py-28 text-center">{q ? '검색 결과가 없습니다.' : '아직 글이 없습니다.'}</p>
        ) : (
          <>
            {/* ── 대표 기사 + 최신 2 ── */}
            {featured && (
              <section className="mt-6 md:mt-9 grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-4 md:gap-5 items-start">
                {/* 대표 기사 — 썸네일 위, 글은 아래(썸네일 속 글자와 제목이 겹치지 않게) */}
                <Link href={`/blog/${featured.id}`} className="group block rounded-[26px] overflow-hidden border border-white/10 bg-white/[0.04] hover:border-white/25 transition-colors">
                  <Thumb p={featured} color={catColor(featured.category_id)} className="aspect-[16/10] lg:aspect-[16/9]" />
                  <div className="p-5 md:p-7">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tracking-[0.12em] uppercase text-white" style={{ background: catColor(featured.category_id) }}>{catName(featured.category_id)}</span>
                    <h2 className="mt-3 text-[24px] md:text-[34px] font-black leading-[1.16] tracking-[-0.02em] group-hover:text-[#ff8aa6] transition-colors">{featured.title}</h2>
                    {featured.excerpt && <p className="mt-2.5 text-[14px] text-white/55 leading-relaxed line-clamp-2">{featured.excerpt}</p>}
                    <div className="mt-3.5 flex items-center gap-3">
                      <Meta p={featured} />
                      <span className="text-[12.5px] font-bold text-white/70 group-hover:text-[#ff8aa6] transition-colors">읽기 →</span>
                    </div>
                  </div>
                </Link>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
                  {subs.map(p => (
                    <Link key={p.id} href={`/blog/${p.id}`} className="group flex gap-3.5 lg:flex-col lg:gap-0 rounded-[22px] overflow-hidden bg-white/[0.04] border border-white/10 hover:border-white/25 hover:bg-white/[0.07] transition-colors">
                      <Thumb p={p} color={catColor(p.category_id)} className="w-[116px] shrink-0 aspect-square lg:w-full lg:aspect-[16/9]" />
                      <div className="py-3 pr-3.5 lg:p-4 flex flex-col gap-1.5 min-w-0">
                        <CatTag name={catName(p.category_id)} color={catColor(p.category_id)} />
                        <h3 className="text-[15.5px] font-bold leading-snug tracking-[-0.01em] line-clamp-2 group-hover:text-[#ff8aa6] transition-colors">{p.title}</h3>
                        <Meta p={p} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── 인기 TOP 5 ── */}
            {popular.length > 0 && (
              <section className="mt-9 md:mt-12">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[17px] md:text-[19px] font-extrabold tracking-[-0.01em]">지금 많이 읽는 글</h2>
                  <span className="text-[11.5px] text-white/35 tracking-[0.18em] font-bold">POPULAR</span>
                </div>
                <ol className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-5 gap-y-1.5">
                  {popular.map((p, i) => (
                    <li key={p.id} className="border-t border-white/10 pt-3">
                      <Link href={`/blog/${p.id}`} className="group flex gap-2.5">
                        <span className="text-[19px] font-black tabular-nums leading-none" style={{ color: i === 0 ? '#ff2d6f' : 'rgba(255,255,255,0.22)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-bold leading-snug line-clamp-2 group-hover:text-[#ff8aa6] transition-colors">{p.title}</span>
                          <span className="mt-1 block text-[11px] text-white/35 tabular-nums">{(p.view_count ?? 0).toLocaleString()} 읽음</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* ── 글 목록(카드 그리드) ── */}
            {list.length > 0 && (
              <section className="mt-9 md:mt-12">
                <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
                  <h2 className="text-[17px] md:text-[19px] font-extrabold tracking-[-0.01em]">{first ? '최신 글' : q ? '검색 결과' : catName(cat ?? null)}</h2>
                  <span className="text-[12px] text-white/35 tabular-nums">{rest.length}개 · {page}/{totalPages}</span>
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                  {list.map(p => (
                    <article key={p.id}>
                      <Link href={`/blog/${p.id}`} className="group block">
                        <Thumb p={p} color={catColor(p.category_id)} className="aspect-[16/10] rounded-[18px] border border-white/10" />
                        <div className="mt-3 flex flex-col gap-1.5">
                          <CatTag name={catName(p.category_id)} color={catColor(p.category_id)} />
                          <h3 className="text-[16.5px] font-bold leading-snug tracking-[-0.01em] line-clamp-2 group-hover:text-[#ff8aa6] transition-colors">{p.title}</h3>
                          {p.excerpt && <p className="text-[13.5px] text-white/45 leading-relaxed line-clamp-2">{p.excerpt}</p>}
                          <Meta p={p} />
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="페이지">
                    <Link aria-disabled={page <= 1} href={qs({ page: Math.max(1, page - 1) })} className={`h-10 px-4 inline-flex items-center rounded-full text-[13px] font-bold ${page <= 1 ? 'pointer-events-none opacity-30 text-white/50' : 'border border-white/15 text-white hover:bg-white/[0.08]'}`}>이전</Link>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2).reduce<(number | '…')[]>((a, n) => { const prev = a[a.length - 1]; if (typeof prev === 'number' && n - prev > 1) a.push('…'); a.push(n); return a }, []).map((n, i) => n === '…' ? <span key={`e${i}`} className="px-1 text-white/30">…</span> : (
                      <Link key={n} href={qs({ page: n })} className={`h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${n === page ? 'bg-white text-[#0b0910]' : 'text-white/55 hover:bg-white/[0.08]'}`}>{n}</Link>
                    ))}
                    <Link aria-disabled={page >= totalPages} href={qs({ page: Math.min(totalPages, page + 1) })} className={`h-10 px-4 inline-flex items-center rounded-full text-[13px] font-bold ${page >= totalPages ? 'pointer-events-none opacity-30 text-white/50' : 'border border-white/15 text-white hover:bg-white/[0.08]'}`}>다음</Link>
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
