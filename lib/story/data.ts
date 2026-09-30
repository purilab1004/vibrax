// STORY 공개 데이터 — 쿠키 없는 익명 클라이언트 + 서버 캐시(쿠키를 쓰면 동적 렌더링이 강제돼 캐시가 무효)
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { STORY_SOURCE } from './core'

const anon = () => createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export interface StoryEpisode {
  id: string
  game_id: string
  no: number
  title: string
  excerpt: string
  thumbnail_url: string | null
  published_at: string | null
  view_count: number
}
export interface StorySeries {
  game: { id: string; title: string; genre: string; thumbnail_url: string | null; teaser: string | null; intro: string | null; coin_cost: number | null; view_count: number; studio_project_id: string | null }
  author: string
  episodes: StoryEpisode[]      // 1화부터
  latestAt: string              // 최신 회차 게시 시각
  views: number                 // 회차 조회 합
  cover: string | null          // 첫 컷(없으면 게임 썸네일)
}

type Row = Omit<StoryEpisode, 'no'> & { created_at: string; games: (StorySeries['game'] & { profiles: { username: string | null; agent_name: string | null } | null }) | null }

export const getStoryData = unstable_cache(
  async (): Promise<StorySeries[]> => {
    const { data } = await anon().from('blog_posts')
      .select('id, game_id, title, excerpt, thumbnail_url, published_at, view_count, created_at, games(id, title, genre, thumbnail_url, teaser, intro, coin_cost, view_count, studio_project_id, profiles!games_user_id_fkey(username, agent_name))')
      .eq('published', true).eq('source', STORY_SOURCE).not('game_id', 'is', null)
      .order('created_at', { ascending: true })
    const map = new Map<string, StorySeries>()
    for (const r of (data ?? []) as unknown as Row[]) {
      if (!r.games) continue
      let s = map.get(r.game_id)
      if (!s) {
        const { profiles, ...game } = r.games
        s = { game, author: profiles?.agent_name || profiles?.username || 'Vibrexcup', episodes: [], latestAt: '', views: 0, cover: null }
        map.set(r.game_id, s)
      }
      s.episodes.push({ id: r.id, game_id: r.game_id, no: s.episodes.length + 1, title: r.title, excerpt: r.excerpt, thumbnail_url: r.thumbnail_url, published_at: r.published_at, view_count: r.view_count })
      s.views += r.view_count ?? 0
      if ((r.published_at ?? '') > s.latestAt) s.latestAt = r.published_at ?? ''
    }
    for (const s of map.values()) s.cover = s.episodes[0]?.thumbnail_url ?? s.game.thumbnail_url
    return [...map.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt))
  },
  ['story-series'], { revalidate: 120 },
)

export const getEpisode = unstable_cache(
  async (id: string) => {
    const { data } = await anon().from('blog_posts').select('*').eq('id', id).eq('published', true).maybeSingle()
    return data as { id: string; title: string; content: string; excerpt: string; thumbnail_url: string | null; published_at: string | null; updated_at: string; view_count: number; game_id: string | null; source: string | null } | null
  },
  ['story-episode'], { revalidate: 300 },
)

/** 최근 3일 안에 올라온 회차가 있으면 UP */
export const isUp = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() < 3 * 86400_000

export const fmtDate = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }

export const GENRE_KO: Record<string, string> = { action: '액션', adventure: '어드벤처', strategy: '전략', sports: '스포츠', arcade: '아케이드' }
