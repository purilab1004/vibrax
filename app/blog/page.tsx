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
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

export default async function BlogPage({ searchParams }: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams
  const { cats, posts: all } = await getBlogData()
  const posts = cat ? all.filter(p => p.category_id === cat) : all
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? 'JOURNAL'

  const catLink = (id: string, label: string) => (
    <Link
      key={id || 'all'}
      href={id ? `/blog?cat=${id}` : '/blog'}
      className={`text-[13px] font-medium px-4 py-2 rounded-full border transition-colors ${
        (cat ?? '') === id
          ? 'border-[#2563eb] text-white bg-[#2563eb]'
          : 'border-[#ebe4d6] text-[#6b6152] hover:text-[#241f17] hover:border-[#cfc4ab]'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#2563eb] text-base tracking-widest mb-6">블로그</h1>
      <div className="flex justify-between gap-2 flex-wrap mb-10">
        <div className="flex gap-2 flex-wrap">
          {catLink('', '전체')}
          {cats.map(c => catLink(c.id, c.name))}
        </div>
        <Link href="/notices" className="text-[13px] font-medium px-4 py-2 rounded-full border border-[#ebe4d6] text-[#857a68] hover:text-[#2563eb] hover:border-[#2563eb] transition-colors">
          공지사항 →
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-[#857a68] text-base py-20 text-center">아직 글이 없습니다.</p>
      ) : (
        /* 에디토리얼 그리드 — 큰 칸/작은 칸이 섞인 헤어라인 레이아웃 (6개 주기 패턴) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-[#ddd3bf]">
          {posts.map((p, i) => {
            // 패턴: [넓게, 좁게, 좁게, 좁게, 좁게, 넓게] — 4열 기준 2행마다 리듬이 반복된다
            const big = i % 6 === 0 || i % 6 === 5
            return (
            <Link
              key={p.id}
              href={`/blog/${p.id}`}
              className={`group border-b border-r border-[#ddd3bf] flex flex-col hover:bg-white transition-colors ${
                big ? 'md:col-span-2 p-7' : 'p-6'
              }`}
            >
              {/* 상단 — 카테고리 라벨 · 날짜 */}
              <div className="flex items-baseline justify-between mb-5">
                <span className="font-pixel text-[11px] tracking-[0.18em] text-[#241f17] uppercase">
                  {catName(p.category_id)}
                </span>
                <span className="text-[13px] text-[#857a68] tabular-nums">{fmtDate(p.published_at)}</span>
              </div>
              {/* 이미지 — 큰 칸은 와이드, 작은 칸은 4:3 */}
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnail_url}
                  alt=""
                  className={`w-full object-cover mb-5 grayscale-[15%] group-hover:grayscale-0 transition-[filter] duration-300 ${
                    big ? 'aspect-[16/8]' : 'aspect-[4/3]'
                  }`}
                />
              ) : (
                <div className={`w-full mb-5 bg-[#f5efe3] flex items-center justify-center ${big ? 'aspect-[16/8]' : 'aspect-[4/3]'}`}>
                  <span className="font-pixel text-[#2563eb]/20 text-xs">VIBREX<span className="text-[#c9940c]/20">CUP</span></span>
                </div>
              )}
              {/* 제목 — 발췌가 한 문장처럼 이어진다. 큰 칸은 타이포도 크게 */}
              <p className={`leading-relaxed text-[#4a4337] ${big ? 'text-[17px] max-w-2xl' : 'text-[15px]'}`}>
                <span className="font-bold text-[#241f17] group-hover:underline decoration-[#2563eb] decoration-2 underline-offset-4">
                  {p.title}
                </span>
                {p.excerpt && <> — <span className="line-clamp-3 inline">{p.excerpt}</span></>}
              </p>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
