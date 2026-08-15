import { createClient } from '@/lib/supabase/server'

// 블로그 RSS 2.0 피드 — 네이버 서치어드바이저는 RSS 제출 시 글 단위 수집이 빨라진다
export const revalidate = 3600

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('id, title, excerpt, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  const posts = (data as { id: string; title: string; excerpt: string | null; published_at: string }[] | null) ?? []

  const items = posts
    .map(
      p => `    <item>
      <title>${esc(p.title)}</title>
      <link>https://vibrexcup.com/blog/${p.id}</link>
      <guid isPermaLink="true">https://vibrexcup.com/blog/${p.id}</guid>
      <description>${esc(p.excerpt ?? '')}</description>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vibrexcup 비브렉스컵 블로그</title>
    <link>https://vibrexcup.com/blog</link>
    <description>바이브코딩 가이드, 프롬프트 팁, AI 게임 트렌드, Vibrexcup 플랫폼 소식</description>
    <language>ko</language>
    <lastBuildDate>${new Date(posts[0]?.published_at ?? Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
