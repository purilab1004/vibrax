import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { BlogCategory, BlogPost } from '@/lib/supabase/types'
import { stripHtml, makeExcerpt } from '@/lib/blog/excerpt'
import BlogViewPing from '@/components/BlogViewPing'
import BlogActions from '@/components/blog/BlogActions'

// 검색엔진·AI 크롤러가 본문과 메타를 읽을 수 있도록 서버 렌더링한다.
export const revalidate = 300

async function fetchPost(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts').select('*').eq('id', id).eq('published', true).maybeSingle()
  return data as BlogPost | null
}

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

  let cat: BlogCategory | null = null
  if (post.category_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('blog_categories').select('*').eq('id', post.category_id).maybeSingle()
    cat = data as BlogCategory | null
  }

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
