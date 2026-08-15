import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// 블로그 목록 — 서버 캐시 120초 + 엣지 캐시. 공개 데이터라 익명 클라이언트 사용.
const getBlogData = unstable_cache(
  async () => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const [{ data: cats }, { data: posts }] = await Promise.all([
      sb.from('blog_categories').select('*').order('sort_order'),
      sb.from('blog_posts').select('*').eq('published', true).order('published_at', { ascending: false }),
    ])
    return { cats: cats ?? [], posts: posts ?? [] }
  },
  ['blog-list'],
  { revalidate: 120 },
)

export async function GET() {
  const data = await getBlogData()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  })
}
