import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'

// 블로그 목록 — 서버 렌더 + 캐시 (클라이언트 왕복 없이 즉시 표시)
export const revalidate = 120

const getBlogData = unstable_cache(
  async () => {
    const sb = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const [{ data: cats }, { data: posts }] = await Promise.all([
      sb.from('blog_categories').select('*').order('sort_order'),
      sb.from('blog_posts').select('id, category_id, title, thumbnail_url, excerpt, published_at, view_count')
        .eq('published', true).order('published_at', { ascending: false }),
    ])
    return {
      cats: (cats ?? []) as BlogCategory[],
      posts: (posts ?? []) as Pick<BlogPost, 'id' | 'category_id' | 'title' | 'thumbnail_url' | 'excerpt' | 'published_at' | 'view_count'>[],
    }
  },
  ['blog-page'],
  { revalidate: 120 },
)

const fmtDate = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default async function BlogPage({ searchParams }: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams
  const { cats, posts: all } = await getBlogData()
  const posts = cat ? all.filter(p => p.category_id === cat) : all
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? 'JOURNAL'

  const featured = !cat && posts.length > 0 ? posts[0] : null
  const rest = featured ? posts.slice(1) : posts
  const readMin = (t?: string | null) => Math.max(1, Math.round(((t ?? '').length + 400) / 500))
  const CAT_COLORS = ['#2563eb', '#7c3aed', '#059669', '#f59e0b', '#e11d48', '#0891b2']
  const catColor = (id: string | null) => CAT_COLORS[Math.max(0, cats.findIndex(c => c.id === id)) % CAT_COLORS.length]

  const catLink = (id: string, label: string) => (
    <Link key={id || 'all'} href={id ? `/blog?cat=${id}` : '/blog'}
      className={`h-9 px-4 rounded-full text-[13px] font-semibold border transition-all whitespace-nowrap ${(cat ?? '') === id ? 'bg-[#241f17] text-white border-[#241f17] shadow-[0_6px_16px_-6px_rgba(36,31,23,0.5)]' : 'bg-white/70 backdrop-blur border-[#e6dfd0] text-[#6b6152] hover:text-[#241f17] hover:border-[#241f17]/40'}`}>
      {label}
    </Link>
  )

  return (
    <div className="relative overflow-hidden">
      {/* 히어로 — AI 저널 */}
      <section className="relative">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[#0b1020]" />
          <div className="absolute -top-40 left-1/4 w-[640px] h-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.55),transparent)] blur-3xl" />
          <div className="absolute -bottom-52 right-0 w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(6,182,212,0.4),transparent)] blur-3xl" />
          <div className="absolute top-10 right-1/4 w-[320px] h-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.35),transparent)] blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-14 pb-16 text-white">
          <p className="font-pixel text-[10px] tracking-[0.35em] text-[#60a5fa]">VIBREX JOURNAL · WRITTEN WITH AI</p>
          <h1 className="mt-3 text-[38px] md:text-[56px] leading-[1.02] font-extrabold tracking-tight max-w-3xl">
            게임이 태어나는 순간을 <span className="bg-gradient-to-r from-[#60a5fa] via-[#22d3ee] to-[#fbbf24] bg-clip-text text-transparent">AJ가 기록합니다</span>
          </h1>
          <p className="mt-4 text-[15px] text-white/60 max-w-xl leading-relaxed">새로 게시된 게임의 출시 노트, 제작 뒷이야기, 프롬프트 팁과 토너먼트 소식. 글의 절반은 AI 게임 기업가 AJ가 씁니다.</p>
          <div className="mt-8 flex items-center gap-2 flex-wrap">
            {catLink('', '전체')}
            {cats.map(c => catLink(c.id, c.name))}
            <Link href="/notices" className="h-9 px-4 rounded-full text-[13px] font-semibold border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-colors">공지사항 →</Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {posts.length === 0 ? (
          <p className="text-[#857a68] text-base py-24 text-center">아직 글이 없습니다.</p>
        ) : (
          <>
            {/* 대표 글 — 히어로 아래로 살짝 겹치는 큰 카드 */}
            {featured && (
              <Link href={`/blog/${featured.id}`} className="group relative block -mt-8 rounded-3xl overflow-hidden bg-[#241f17] text-white shadow-[0_40px_80px_-30px_rgba(36,31,23,0.5)] ring-1 ring-black/10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr]">
                  <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[420px] overflow-hidden">
                    {featured.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
                    ) : <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb] to-[#06b6d4]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#241f17]/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#241f17]" />
                  </div>
                  <div className="relative p-7 md:p-10 flex flex-col justify-end">
                    <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide"><span className="rounded-full px-2.5 py-1 text-white" style={{ background: catColor(featured.category_id) }}>{catName(featured.category_id)}</span><span className="rounded-full px-2.5 py-1 bg-white/10 text-white/80">FEATURED</span></div>
                    <h2 className="mt-4 text-[26px] md:text-[34px] font-extrabold leading-[1.15] tracking-tight group-hover:underline decoration-[#60a5fa] decoration-4 underline-offset-8">{featured.title}</h2>
                    {featured.excerpt && <p className="mt-3 text-[14px] text-white/70 leading-relaxed line-clamp-3">{featured.excerpt}</p>}
                    <p className="mt-5 text-[12px] text-white/50">{fmtDate(featured.published_at)} · {readMin(featured.excerpt)}분 읽기 · 조회 {(featured.view_count ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            )}

            {/* 카드 그리드 */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${featured ? 'mt-10' : 'mt-2'}`}>
              {rest.map((p) => (
                <Link key={p.id} href={`/blog/${p.id}`} className="group flex flex-col rounded-2xl overflow-hidden bg-white border border-[#ebe4d6] hover:border-[#cfc4ab] hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(36,31,23,0.35)] transition-all duration-300">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#f1ece2]">
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#e0ecff] to-[#c7f0f7]"><span className="text-[13px] font-extrabold text-[#2563eb]/40">vibrex<span className="text-[#06b6d4]/40">cup</span></span></div>
                    )}
                    <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white shadow" style={{ background: catColor(p.category_id) }}>{catName(p.category_id)}</span>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-[17px] font-bold leading-snug text-[#241f17] group-hover:text-[#2563eb] transition-colors line-clamp-2">{p.title}</h3>
                    {p.excerpt && <p className="mt-2 text-[13.5px] text-[#6b6152] leading-relaxed line-clamp-3">{p.excerpt}</p>}
                    <div className="mt-auto pt-4 flex items-center justify-between text-[11.5px] text-[#9d9280]"><span>{fmtDate(p.published_at)} · {readMin(p.excerpt)}분</span><span className="inline-flex items-center gap-1">조회 {(p.view_count ?? 0).toLocaleString()}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
