import Link from 'next/link'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import { stripHtml, makeExcerpt } from '@/lib/blog/excerpt'
import BlogViewPing from '@/components/BlogViewPing'
import BlogActions from '@/components/blog/BlogActions'

// 검색엔진·AI 크롤러가 본문과 메타를 읽을 수 있도록 서버 렌더링한다.
export const revalidate = 300

// 공개 데이터 — 쿠키 없는 익명 클라이언트 + 서버 캐시 (쿠키를 쓰면 동적 렌더링이 강제돼 캐시가 무효)
const anon = () => createAnonClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const fetchPost = unstable_cache(
  async (id: string) => {
    const { data } = await anon()
      .from('blog_posts').select('*').eq('id', id).eq('published', true).maybeSingle()
    return data as BlogPost | null
  },
  ['blog-post'],
  { revalidate: 300 },
)

const fetchLinkedGame = unstable_cache(
  async (id: string) => {
    const { data } = await anon()
      .from('games').select('id, title, thumbnail_url, teaser, teaser_en, coin_cost, view_count')
      .eq('id', id).maybeSingle()
    return data as (Pick<import('@/lib/supabase/types').Game, 'id' | 'title' | 'thumbnail_url' | 'teaser' | 'teaser_en' | 'coin_cost' | 'view_count'>) | null
  },
  ['blog-linked-game'],
  { revalidate: 300 },
)

const fetchCategory = unstable_cache(
  async (id: string) => {
    const { data } = await anon()
      .from('blog_categories').select('*').eq('id', id).maybeSingle()
    return data as BlogCategory | null
  },
  ['blog-category'],
  { revalidate: 600 },
)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await fetchPost(id)
  if (!post) return { title: 'Blog' }
  const description = post.excerpt || makeExcerpt(post.content)
  return {
    title: post.title,
    description,
    alternates: { canonical: `https://vibrexcup.com/blog/${post.id}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: `https://vibrexcup.com/blog/${post.id}`,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      ...(post.thumbnail_url ? { images: [{ url: post.thumbnail_url }] } : {}),
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await fetchPost(id)

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-[#6b6152] text-base mb-6">글을 찾을 수 없습니다.</p>
        <Link href="/blog" className="font-pixel text-[11px] text-[#2563eb] tracking-widest">BACK TO LIST</Link>
      </div>
    )
  }

  const cat: BlogCategory | null = post.category_id ? await fetchCategory(post.category_id) : null
  // 게임 소개글이면 우측에 게임 카드 노출
  const linkedGame = post.game_id ? await fetchLinkedGame(post.game_id) : null

  // Article 구조화 데이터 — 구글/네이버/AI 검색 노출용
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: 'Vibrexcup' },
    publisher: { '@type': 'Organization', name: 'Vibrexcup', url: 'https://vibrexcup.com' },
    mainEntityOfPage: `https://vibrexcup.com/blog/${post.id}`,
    description: post.excerpt || stripHtml(post.content).slice(0, 200),
    ...(post.thumbnail_url ? { image: post.thumbnail_url } : {}),
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 lg:flex lg:gap-10 lg:items-start">
      <article className="flex-1 min-w-0 max-w-3xl mx-auto lg:mx-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <BlogViewPing postId={post.id} />
        <Link href="/blog" className="font-pixel text-[11px] text-[#857a68] hover:text-[#2563eb] tracking-widest">← BACK</Link>
        <h1 className="text-[#241f17] text-2xl md:text-3xl font-bold mt-6 mb-3">{post.title}</h1>
        <p className="text-[13px] text-[#857a68] mb-8">
          {cat && <span className="text-[#2563eb] mr-3">{cat.name}</span>}
          {post.published_at ? new Date(post.published_at).toLocaleDateString('ko-KR') : ''}
        </p>
        {post.thumbnail_url && !linkedGame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail_url} alt={post.title} className="w-full mb-8 border border-[#ebe4d6] rounded-xl" />
        )}
        {/* content는 RLS로 admin만 작성 가능 — 신뢰 경계 내 HTML */}
        <div className="rte-content" dangerouslySetInnerHTML={{ __html: post.content }} />
        <div className="mt-10 pt-6 border-t border-[#ebe4d6]">
          <BlogActions postId={post.id} size="md" />
        </div>
      </article>

      {/* 우측 게임 카드 — 소개된 게임을 바로 플레이 */}
      {linkedGame && (
        <aside className="mt-10 lg:mt-14 lg:w-80 shrink-0 lg:sticky lg:top-20">
          <div className="border border-[#ebe4d6] bg-white rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
            {linkedGame.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={linkedGame.thumbnail_url} alt={linkedGame.title} className="w-full aspect-video object-cover" />
            )}
            <div className="p-5">
              <p className="font-pixel text-[10px] text-[#c9940c] tracking-[0.2em] mb-1.5">🎮 PLAY THIS GAME</p>
              <h3 className="text-lg font-extrabold text-[#241f17] leading-snug">{linkedGame.title}</h3>
              {linkedGame.teaser && (
                <p className="mt-1.5 text-[13px] text-[#857a68]">{linkedGame.teaser}</p>
              )}
              <Link
                href={`/games/${linkedGame.id}`}
                className="mt-4 flex items-center justify-center gap-2 h-12 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white font-bold text-[15px] shadow-[0_6px_20px_rgba(37,99,235,0.35)] hover:shadow-[0_8px_26px_rgba(37,99,235,0.45)] transition-shadow"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7-11-7Z" /></svg>
                지금 플레이 · 🪙 {linkedGame.coin_cost ?? 1}
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
