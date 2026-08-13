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
    <article className="max-w-3xl mx-auto px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogViewPing postId={post.id} />
      <Link href="/blog" className="font-pixel text-[11px] text-[#857a68] hover:text-[#2563eb] tracking-widest">← BACK</Link>
      <h1 className="text-[#241f17] text-2xl md:text-3xl font-bold mt-6 mb-3">{post.title}</h1>
      <p className="text-[13px] text-[#857a68] mb-8">
        {cat && <span className="text-[#2563eb] mr-3">{cat.name}</span>}
        {post.published_at ? new Date(post.published_at).toLocaleDateString('ko-KR') : ''}
      </p>
      {post.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnail_url} alt={post.title} className="w-full mb-8 border border-[#ebe4d6] rounded-xl" />
      )}
      {/* content는 RLS로 admin만 작성 가능 — 신뢰 경계 내 HTML */}
      <div className="rte-content" dangerouslySetInnerHTML={{ __html: post.content }} />
      <div className="mt-10 pt-6 border-t border-[#ebe4d6]">
        <BlogActions postId={post.id} size="md" />
      </div>
    </article>
  )
}
