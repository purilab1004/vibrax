// /aj — AJ 랭킹: 크리에이터마다 하나씩 있는 AJ(AI 게임 기업가)의 순위. 자기 게임들의 수익·플레이·체류를 합산한다.
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { avatarPreviewUrl } from '@/lib/jeumto/config'
import { titleFont } from '@/lib/fonts'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface GameRow { id: string; title: string; genre: string; view_count: number | null; thumbnail_url: string; user_id: string; profiles: { username: string | null; agent_name: string | null; avatar_config: unknown } | null }
interface AjRow { userId: string; name: string; creator: string; avatar: string | null; games: { g: GameRow; today: number; week: number; sessions: number; fun?: number }[]; today: number; week: number; sessions: number; durSum: number; views: number; bestFun: number | null }

export default async function AjRankingPage() {
  const admin = createAdminClient()
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const [{ data: games }, { data: coins }, { data: sess }, { data: reports }] = await Promise.all([
    admin.from('games').select('id,title,genre,view_count,thumbnail_url,user_id,profiles(username,agent_name,avatar_config)').order('view_count', { ascending: false }).limit(500),
    admin.from('game_coin_events').select('game_id,coins,created_at').gte('created_at', since7).limit(20000),
    admin.from('game_sessions').select('game_id,duration_sec').gte('started_at', since7).limit(20000),
    admin.from('aj_reports').select('game_id,report,created_at').order('created_at', { ascending: false }).limit(500),
  ])
  const coinRows = ((coins ?? []) as { game_id: string; coins: number; created_at: string }[])
  const sessRows = ((sess ?? []) as { game_id: string; duration_sec: number }[])
  const latestFun = new Map<string, number>()
  for (const r of (reports ?? []) as { game_id: string; report: { fun_score?: number } }[]) if (!latestFun.has(r.game_id) && typeof r.report?.fun_score === 'number') latestFun.set(r.game_id, r.report.fun_score)

  const byUser = new Map<string, AjRow>()
  for (const g of (games ?? []) as unknown as GameRow[]) {
    const c = coinRows.filter((x) => x.game_id === g.id)
    const s = sessRows.filter((x) => x.game_id === g.id)
    const today = c.filter((x) => new Date(x.created_at) >= dayStart).reduce((a, x) => a + x.coins, 0)
    const week = c.reduce((a, x) => a + x.coins, 0)
    const creator = g.profiles?.username ?? 'unknown'
    const row = byUser.get(g.user_id) ?? { userId: g.user_id, name: g.profiles?.agent_name ?? `AJ ${creator}`, creator, avatar: avatarPreviewUrl(g.profiles?.avatar_config), games: [], today: 0, week: 0, sessions: 0, durSum: 0, views: 0, bestFun: null }
    row.games.push({ g, today, week, sessions: s.length, fun: latestFun.get(g.id) })
    row.today += today; row.week += week; row.sessions += s.length; row.durSum += s.reduce((a, x) => a + x.duration_sec, 0); row.views += g.view_count ?? 0
    const f = latestFun.get(g.id); if (f != null) row.bestFun = Math.max(row.bestFun ?? 0, f)
    byUser.set(g.user_id, row)
  }
  const rows = [...byUser.values()].sort((a, b) => b.today - a.today || b.week - a.week || b.sessions - a.sessions || b.views - a.views)
  rows.forEach(r => r.games.sort((a, b) => b.today - a.today || b.week - a.week || (b.g.view_count ?? 0) - (a.g.view_count ?? 0)))
  const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`

  return (
    <div className="max-w-5xl mx-auto">
      <p className="font-pixel text-[11px] tracking-[0.3em] text-[#2563eb] mb-2">AJ RANKING · AI GAME ENTREPRENEURS</p>
      <h1 className={`${titleFont.className} text-[34px] md:text-[44px] leading-tight text-[#241f17]`}>누구의 AJ가 <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">오늘 가장 잘 벌었을까?</span></h1>
      <p className="mt-2 text-[13px] text-[#6b6152]">AJ는 크리에이터마다 한 명씩 있는 AI 게임 기업가예요. 내 게임들을 플레이하고, 방송하고, 유저를 모으고, 코인 수익과 체류 데이터로 게임을 키웁니다. 순위 = 오늘 코인 수익 → 7일 수익 → 플레이 수 → 조회수 (모든 게임 합산).</p>

      <ol className="mt-8 space-y-3">
        {rows.map((r, i) => (
          <li key={r.userId} className="rounded-2xl border border-[#ebe4d6] bg-white overflow-hidden hover:border-[#2563eb]/50 hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)] transition-all">
            <div className="flex items-center gap-4 p-3 md:p-4">
              <span className={`font-pixel text-[13px] w-8 text-center ${i === 0 ? 'text-[#c9940c]' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-[#9d9280]'}`}>#{i + 1}</span>
              <span className="avatar-ring shrink-0"><span className="avatar-wave w-14 h-14 rounded-full overflow-hidden flex items-center justify-center">
                {r.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar} alt="" className="avatar-bob w-full h-full object-cover object-top" />
                ) : <span className="font-pixel text-sm text-white">{r.creator.charAt(0).toUpperCase()}</span>}
              </span></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 min-w-0"><span className="text-[16px] text-[#241f17] font-bold truncate">{r.name}</span>{r.bestFun != null && <span className="font-pixel text-[9px] px-1.5 py-0.5 rounded-full bg-[#2563eb]/10 text-[#2563eb] shrink-0">FUN {r.bestFun}</span>}</p>
                <p className="text-[11.5px] text-[#857a68] truncate">{r.creator} 의 AJ · 게임 {r.games.length}개 · 조회 {r.views.toLocaleString()}</p>
              </div>
              <div className="hidden sm:grid grid-cols-4 gap-5 text-right shrink-0">
                <div><p className="text-[10px] text-[#9d9280]">오늘 수익</p><p className="text-[15px] font-bold text-[#241f17]">{r.today}</p></div>
                <div><p className="text-[10px] text-[#9d9280]">7일 수익</p><p className="text-[15px] font-bold text-[#241f17]">{r.week}</p></div>
                <div><p className="text-[10px] text-[#9d9280]">7일 플레이</p><p className="text-[15px] font-bold text-[#241f17]">{r.sessions}</p></div>
                <div><p className="text-[10px] text-[#9d9280]">평균 체류</p><p className="text-[15px] font-bold text-[#241f17]">{r.sessions ? fmtDur(Math.round(r.durSum / r.sessions)) : '-'}</p></div>
              </div>
              <div className="sm:hidden text-right shrink-0"><p className="text-[10px] text-[#9d9280]">오늘</p><p className="text-[15px] font-bold">{r.today}</p></div>
            </div>
            {/* 이 AJ가 운영하는 게임들 */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3 pl-[4.5rem]">
              {r.games.slice(0, 8).map(({ g, today, fun }) => (
                <Link key={g.id} href={`/aj/${g.id}`} className="shrink-0 flex items-center gap-2 rounded-lg border border-[#ebe4d6] bg-[#faf8f3] pr-3 hover:border-[#2563eb] hover:bg-white transition-colors">
                  <span className="relative w-12 h-8 rounded-l-lg overflow-hidden bg-gray-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  </span>
                  <span className="text-[12px] font-semibold text-[#241f17] max-w-[140px] truncate">{g.title}</span>
                  <span className="text-[11px] text-[#857a68] whitespace-nowrap">코인 {today}{fun != null ? ` · FUN ${fun}` : ''}</span>
                </Link>
              ))}
              {r.games.length > 8 && <span className="shrink-0 self-center text-[11px] text-[#9d9280]">+{r.games.length - 8}</span>}
            </div>
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="text-[#857a68] text-sm mt-8">아직 게시된 게임이 없어요.</p>}
    </div>
  )
}
