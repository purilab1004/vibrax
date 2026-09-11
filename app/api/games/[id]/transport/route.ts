// 게임 transport — 목표 점수(관리자 지정 또는 플레이 데이터 자동)와 다음 게임 후보. POST 는 이동 기록.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLeaderboard } from '@/lib/games/leaderboard'

export const dynamic = 'force-dynamic'

interface G { id: string; title: string; genre: string; thumbnail_url: string; view_count: number; created_at: string; goal_score?: number | null; coin_cost?: number | null; play_url?: string; user_id?: string; description?: string | null; language?: string | null }

/** 보기 좋은 목표 숫자로 반올림 (1,234 → 1,200 / 87 → 90 / 12 → 10) */
function nice(n: number): number {
  if (n < 10) return Math.max(1, Math.round(n))
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  let cur: G | null = null
  {
    const r = await admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,goal_score,coin_cost').eq('id', id).maybeSingle()
    if (r.error && /goal_score/.test(r.error.message)) { const r2 = await admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,coin_cost,play_url,user_id,description,language').eq('id', id).maybeSingle(); cur = (r2.data as G | null) }
    else cur = (r.data as G | null)
  }
  if (!cur) return Response.json({ error: 'not found' }, { status: 404 })

  // 목표: 관리자 지정 > 최근 90일 플레이 점수 60% 지점(표본 5개 이상) > 없음(클리어/게임오버로 판정)
  let goal: number | null = typeof cur.goal_score === 'number' && cur.goal_score > 0 ? cur.goal_score : null
  let goalSource: 'admin' | 'auto' | 'finish' = goal ? 'admin' : 'finish'
  if (!goal) {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString()
    const { data: sess } = await admin.from('game_sessions').select('score_max').eq('game_id', id).gte('started_at', since).not('score_max', 'is', null).gt('score_max', 0).limit(2000)
    const scores = ((sess ?? []) as { score_max: number }[]).map(s => s.score_max).sort((a, b) => a - b)
    if (scores.length >= 5) { goal = nice(scores[Math.min(scores.length - 1, Math.floor(scores.length * 0.6))]); goalSource = 'auto' }
  }

  // 회원 TOP 10 — 진입하면 transport 활성 (관리자 목표 점수와 둘 중 하나만 만족해도 됨)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lbP = loadLeaderboard(admin, id, user?.id ?? null)
  // 다음 게임 후보: 같은 장르 인기 1 + 최신 1 + 무작위 1 (중복·현재 제외)
  const [{ data: sameGenre }, { data: recent }, { data: pool }] = await Promise.all([
    admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,coin_cost,play_url,user_id,description,language').eq('genre', cur.genre).neq('id', id).order('view_count', { ascending: false }).limit(6),
    admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,coin_cost,play_url,user_id,description,language').neq('id', id).order('created_at', { ascending: false }).limit(6),
    admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,coin_cost,play_url,user_id,description,language').neq('id', id).order('view_count', { ascending: false }).limit(40),
  ])
  const pick = (arr: G[] | null, used: Set<string>) => { for (const g of (arr ?? [])) if (!used.has(g.id)) { used.add(g.id); return g } return null }
  const used = new Set<string>([id])
  const next: (G & { reason: string })[] = []
  const a = pick((sameGenre ?? []) as G[], used); if (a) next.push({ ...a, reason: '같은 장르 인기' })
  const b = pick((recent ?? []) as G[], used); if (b) next.push({ ...b, reason: '새로 나온 게임' })
  const rest = ((pool ?? []) as G[]).filter(g => !used.has(g.id))
  const c = rest.length ? rest[Math.floor(Math.random() * rest.length)] : null; if (c) { used.add(c.id); next.push({ ...c, reason: '랜덤 추천' }) }
  while (next.length < 3) { const d = pick((recent ?? []) as G[], used) ?? pick((pool ?? []) as G[], used); if (!d) break; next.push({ ...d, reason: '추천' }) }
  const lb = await lbP
  return Response.json({ goal, goalSource, leaderboard: lb, meId: user?.id ?? null, next: next.map(g => ({ id: g.id, title: g.title, genre: g.genre, thumbnail_url: g.thumbnail_url, coin_cost: g.coin_cost ?? 1, reason: g.reason, play_url: g.play_url ?? '', user_id: g.user_id ?? '', description: g.description ?? null, language: g.language ?? null })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await req.json().catch(() => null) as { to?: string; score?: number; goal?: number | null; picked?: boolean } | null
  if (!b?.to || !/^[0-9a-f-]{36}$/i.test(b.to)) return Response.json({ error: 'bad request' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  await admin.from('game_transports').insert([{ from_game: id, to_game: b.to, user_id: user?.id ?? null, score: typeof b.score === 'number' ? Math.round(b.score) : null, goal: typeof b.goal === 'number' ? b.goal : null, picked: !!b.picked }] as never)
  return Response.json({ ok: true })
}
