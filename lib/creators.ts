import type { GameWithCreator } from '@/lib/supabase/types'

export interface Creator {
  id: string
  name: string
  avatarUrl: string | null
  games: number
  views: number
}

// 제작자 랭킹 — 게임 개수 우선, 동률이면 총 조회수
export function topCreatorsOf(games: GameWithCreator[]): Creator[] {
  const map = new Map<string, Creator>()
  for (const g of games) {
    const cur = map.get(g.user_id) ?? {
      id: g.user_id,
      name: g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown',
      avatarUrl: g.profiles?.avatar_config?.previewUrl ?? null,
      games: 0,
      views: 0,
    }
    cur.games += 1
    cur.views += g.view_count ?? 0
    map.set(g.user_id, cur)
  }
  return [...map.values()]
    .sort((a, b) => b.games - a.games || b.views - a.views)
    .slice(0, 10)
}
