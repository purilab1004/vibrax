// 게임별 회원 최고점 TOP 10 — game_sessions(자동 플레이 제외)를 회원별로 묶은 RPC. transport 활성 조건(10위 진입)도 여기서 계산.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TopRow { user_id: string; username: string; agent_name: string | null; best: number; achieved_at: string }
export interface Leaderboard { top: TopRow[]; threshold: number | null; full: boolean; me: { best: number; rank: number } | null }
export const TOP_N = 10

export async function loadLeaderboard(admin: SupabaseClient, gameId: string, meId: string | null): Promise<Leaderboard> {
  const { data, error } = await admin.rpc('game_top_scores', { p_game_id: gameId, p_limit: TOP_N })
  const top = (error ? [] : (data ?? [])) as TopRow[]
  const full = top.length >= TOP_N
  // 진입 기준: 10명이 다 차 있으면 10위 점수를 넘어야, 아니면 1점 이상이면 진입
  const threshold = full ? top[TOP_N - 1].best : null
  let me: Leaderboard['me'] = null
  if (meId) {
    const i = top.findIndex(r => r.user_id === meId)
    if (i >= 0) me = { best: top[i].best, rank: i + 1 }
    else {
      const { data: mine } = await admin.from('game_sessions').select('score_max').eq('game_id', gameId).eq('user_id', meId).gt('score_max', 0).order('score_max', { ascending: false }).limit(1).maybeSingle()
      const best = (mine as { score_max: number } | null)?.score_max ?? 0
      if (best > 0) me = { best, rank: 0 }
    }
  }
  return { top, threshold, full, me }
}

/** 이 점수로 들어가면 몇 위인지 (0 = 진입 못 함) */
export function rankFor(lb: Pick<Leaderboard, 'top' | 'full'>, score: number, meId?: string | null): number {
  if (score <= 0) return 0
  const others = meId ? lb.top.filter(r => r.user_id !== meId) : lb.top
  let rank = 1
  for (const r of others) { if (r.best >= score) rank++ }
  return rank <= TOP_N ? rank : 0
}

/** 다음 목표 — 현재 순위(0=밖)와, 한 단계 위(밖이면 10위 진입)까지 필요한 점수 */
export function nextTarget(lb: Pick<Leaderboard, 'top' | 'full'>, score: number, meId?: string | null): { rank: number; target: number | null; remain: number; toRank: number | null } {
  const others = (meId ? lb.top.filter(r => r.user_id !== meId) : lb.top).slice().sort((a, b) => b.best - a.best)
  const rank = rankFor(lb, score, meId)
  if (rank === 1) return { rank, target: null, remain: 0, toRank: null }
  if (rank > 1) { const above = others[rank - 2]; const target = above.best + 1; return { rank, target, remain: Math.max(0, target - score), toRank: rank - 1 } }
  // 순위 밖: 10명이 차 있으면 10위 점수를 넘어야, 아니면 1점부터
  const target = others.length >= TOP_N ? others[TOP_N - 1].best + 1 : 1
  return { rank: 0, target, remain: Math.max(0, target - score), toRank: Math.min(TOP_N, others.length + 1) }
}
