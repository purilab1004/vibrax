import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://vibrax.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const { data: rawGames } = await supabase
    .from('games')
    .select('id, created_at')
    .order('created_at', { ascending: false })
  const games = rawGames as { id: string; created_at: string }[] | null

  const gameUrls: MetadataRoute.Sitemap = (games ?? []).map(game => ({
    url: `${BASE_URL}/games/${game.id}`,
    lastModified: new Date(game.created_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/games`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...gameUrls,
  ]
}
