// lib/aj/metrics.ts — 게임 하나의 운영 지표 집계 (서버, admin client). AJ 리포트·/aj 대시보드·랭킹 공용.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface GameMetrics {
  gameId: string
  days: number
  sessions: number
  players: number
  avgDurationSec: number
  medianDurationSec: number
  under30sRate: number        // 30초 안에 나간 비율 (초반 이탈)
  telemetrySessions: number   // AJ.event 를 보낸 세션 수
  avgScore: number | null
  avgOversPerSession: number | null
  avgFirstOverSec: number | null
  restartRate: number | null  // 게임오버 후 계속한 비율(대략: overs>=2 세션 비율)
  coinsToday: number
  coins7d: number
  coinsPeriod: number
  views: number
  likes: number
  shares: number
  mobileRate: number
}

export async function collectGameMetrics(admin: SupabaseClient, gameId: string, days = 30): Promise<GameMetrics> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [sess, coinsAll, game, likes, shares] = await Promise.all([
    admin.from('game_sessions').select('user_id,duration_sec,score_max,game_overs,first_over_sec,events,device').eq('game_id', gameId).gte('started_at', since).limit(5000),
    admin.from('game_coin_events').select('coins,created_at').eq('game_id', gameId).gte('created_at', since).limit(10000),
    admin.from('games').select('view_count').eq('id', gameId).maybeSingle(),
    admin.from('game_likes').select('id', { count: 'exact', head: true }).eq('game_id', gameId),
    admin.from('game_shares').select('id', { count: 'exact', head: true }).eq('game_id', gameId),
  ])
  type S = { user_id: string | null; duration_sec: number; score_max: number | null; game_overs: number; first_over_sec: number | null; events: number; device: string | null }
  const rows = ((sess.data ?? []) as S[]).filter((r) => r.duration_sec >= 0)
  const durs = rows.map((r) => r.duration_sec).sort((a, b) => a - b)
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const tele = rows.filter((r) => r.events > 0)
  const scores = tele.map((r) => r.score_max).filter((v): v is number => typeof v === 'number')
  const firstOver = tele.map((r) => r.first_over_sec).filter((v): v is number => typeof v === 'number')
  const coins = (coinsAll.data ?? []) as { coins: number; created_at: string }[]
  return {
    gameId, days,
    sessions: rows.length,
    players: new Set(rows.map((r) => r.user_id).filter(Boolean)).size,
    avgDurationSec: Math.round(avg(durs)),
    medianDurationSec: durs.length ? durs[Math.floor(durs.length / 2)] : 0,
    under30sRate: rows.length ? rows.filter((r) => r.duration_sec < 30).length / rows.length : 0,
    telemetrySessions: tele.length,
    avgScore: scores.length ? Math.round(avg(scores)) : null,
    avgOversPerSession: tele.length ? Number(avg(tele.map((r) => r.game_overs)).toFixed(2)) : null,
    avgFirstOverSec: firstOver.length ? Math.round(avg(firstOver)) : null,
    restartRate: tele.length ? tele.filter((r) => r.game_overs >= 2).length / tele.length : null,
    coinsToday: coins.filter((c) => new Date(c.created_at) >= dayStart).reduce((a, c) => a + c.coins, 0),
    coins7d: coins.filter((c) => c.created_at >= since7).reduce((a, c) => a + c.coins, 0),
    coinsPeriod: coins.reduce((a, c) => a + c.coins, 0),
    views: (game.data as { view_count?: number } | null)?.view_count ?? 0,
    likes: likes.count ?? 0,
    shares: shares.count ?? 0,
    mobileRate: rows.length ? rows.filter((r) => r.device === 'mobile').length / rows.length : 0,
  }
}
