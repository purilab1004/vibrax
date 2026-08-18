// /aj — AJ 랭킹: 게임마다 태어난 AJ(AI 게임 기업가)들의 오늘 수익·체류·플레이 랭킹
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { avatarPreviewUrl } from '@/lib/jeumto/config'
import { ajNameOf } from '@/components/aj/AjBadge'
import { titleFont } from '@/lib/fonts'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface GameRow { id: string; title: string; genre: string; view_count: number | null; thumbnail_url: string; user_id: string; profiles: { username: string | null; agent_name: string | null; avatar_config: unknown } | null }

export default async function AjRankingPage() {
  const admin = createAdminClient()
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const [{ data: games }, { data: coins }, { data: sess }, { data: reports }] = await Promise.all([
    admin.from('games').select('id,title,genre,view_count,thumbnail_url,user_id,profiles(username,agent_name,avatar_config)').order('view_count', { ascending: false }).limit(200),
    admin.from('game_coin_events').select('game_id,coins,created_at').gte('created_at', since7).limit(20000),
    admin.from('game_sessions').select('game_id,duration_sec').gte('started_at', since7).limit(20000),
    admin.from('aj_reports').select('game_id,report,created_at').order('created_at', { ascending: false }).limit(500),
  ])
  const coinRows = ((coins ?? []) as { game_id: string; coins: number; created_at: string }[])
  const sessRows = ((sess ?? []) as { game_id: string; duration_sec: number }[])
  const latestReport = new Map<string, { fun_score?: number; headline?: string }>()
  for (const r of (reports ?? []) as { game_id: string; report: { fun_score?: number; headline?: string } }[]) if (!latestReport.has(r.game_id)) latestReport.set(r.game_id, r.report)

  const rows = ((games ?? []) as unknown as GameRow[]).map((g) => {
    const c = coinRows.filter((x) => x.game_id === g.id)
    const s = sessRows.filter((x) => x.game_id === g.id)
    const today = c.filter((x) => new Date(x.created_at) >= dayStart).reduce((a, x) => a + x.coins, 0)
    const week = c.reduce((a, x) => a + x.coins, 0)
    const avgDur = s.length ? Math.round(s.reduce((a, x) => a + x.duration_sec, 0) / s.length) : 0
    return { g, today, week, sessions: s.length, avgDur, report: latestReport.get(g.id) }
  }).sort((a, b) => b.today - a.today || b.week - a.week || b.sessions - a.sessions || (b.g.view_count ?? 0) - (a.g.view_count ?? 0))

  const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="font-pixel text-[11px] tracking-[0.3em] text-[#2563eb] mb-2">AJ RANKING · AI GAME ENTREPRENEURS</p>
      <h1 className={`${titleFont.className} text-[34px] md:text-[44px] leading-tight text-[#241f17]`}>게임마다 태어난 AJ, <span className="bg-gradient-to-r from-[#2563eb] to-[#06b6d4] bg-clip-text text-transparent">오늘 얼마나 벌었을까?</span></h1>
      <p className="mt-2 text-[13px] text-[#6b6152]">AJ는 게임을 플레이하고, 방송하고, 유저를 모으고, 코인 수익과 체류 데이터를 보며 게임을 키우는 AI 스트리머입니다. 순위 = 오늘 코인 수익 → 7일 수익 → 플레이 수.</p>

      <ol className="mt-8 space-y-3">
        {rows.map((r, i) => {
          const avatar = avatarPreviewUrl(r.g.profiles?.avatar_config)
          const creator = r.g.profiles?.agent_name ?? r.g.profiles?.username ?? 'unknown'
          return (
            <li key={r.g.id}>
              <Link href={`/aj/${r.g.id}`} className="flex items-center gap-4 rounded-2xl border border-[#ebe4d6] bg-white p-3 md:p-4 hover:border-[#2563eb] hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)] transition-all">
                <span className={`font-pixel text-[13px] w-8 text-center ${i === 0 ? 'text-[#c9940c]' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-[#9d9280]'}`}>#{i + 1}</span>
                <span className="avatar-ring shrink-0"><span className="avatar-wave w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="avatar-bob w-full h-full object-cover object-top" />
                  ) : <span className="font-pixel text-sm text-white">{creator.charAt(0).toUpperCase()}</span>}
                </span></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 min-w-0"><span className="font-pixel text-[11px] text-[#2563eb] tracking-widest shrink-0">{ajNameOf(r.g.title)}</span><span className="text-[13px] text-[#241f17] font-semibold truncate">{r.g.title}</span></p>
                  <p className="text-[11px] text-[#857a68] truncate">{creator} · {r.g.genre.toUpperCase()}{r.report?.headline ? ` · ${r.report.headline}` : ''}</p>
                </div>
                <div className="hidden sm:grid grid-cols-4 gap-4 text-right shrink-0">
                  <div><p className="text-[10px] text-[#9d9280]">오늘 수익</p><p className="text-[15px] font-bold text-[#241f17]">🪙 {r.today}</p></div>
                  <div><p className="text-[10px] text-[#9d9280]">7일 수익</p><p className="text-[15px] font-bold text-[#241f17]">🪙 {r.week}</p></div>
                  <div><p className="text-[10px] text-[#9d9280]">7일 플레이</p><p className="text-[15px] font-bold text-[#241f17]">{r.sessions}</p></div>
                  <div><p className="text-[10px] text-[#9d9280]">평균 체류</p><p className="text-[15px] font-bold text-[#241f17]">{r.sessions ? fmtDur(r.avgDur) : '-'}</p></div>
                </div>
                <div className="sm:hidden text-right shrink-0"><p className="text-[10px] text-[#9d9280]">오늘</p><p className="text-[15px] font-bold">🪙 {r.today}</p></div>
                {typeof r.report?.fun_score === 'number' && <span className="hidden md:inline-flex font-pixel text-[10px] px-2 py-1 rounded-full bg-[#2563eb]/10 text-[#2563eb]">FUN {r.report.fun_score}</span>}
              </Link>
            </li>
          )
        })}
      </ol>
      {rows.length === 0 && <p className="text-[#857a68] text-sm mt-8">아직 게시된 게임이 없어요.</p>}
    </div>
  )
}
