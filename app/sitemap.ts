import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://vibrexcup.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const [{ data: rawGames }, { data: rawPosts }, { data: rawNotices }] = await Promise.all([
    supabase.from('games').select('id, created_at').order('created_at', { ascending: false }),
    supabase.from('blog_posts').select('id, published_at, updated_at').eq('published', true)
      .order('published_at', { ascending: false }),
    supabase.from('notices').select('id, updated_at').eq('published', true),
  ])
  const games = rawGames as { id: string; created_at: string }[] | null
  const posts = rawPosts as { id: string; published_at: string | null; updated_at: string }[] | null
  const notices = rawNotices as { id: string; updated_at: string }[] | null

  const gameUrls: MetadataRoute.Sitemap = (games ?? []).map(game => ({
    url: `${BASE_URL}/games/${game.id}`,
    lastModified: new Date(game.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  const postUrls: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
    url: `${BASE_URL}/blog/${p.id}`,
    lastModified: new Date(p.updated_at ?? p.published_at ?? Date.now()),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  const noticeUrls: MetadataRoute.Sitemap = (notices ?? []).map(n => ({
    url: `${BASE_URL}/notices/${n.id}`,
    lastModified: new Date(n.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/games`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/notices`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/studio`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/credits`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]

  return [...staticUrls, ...postUrls, ...gameUrls, ...noticeUrls]
}
