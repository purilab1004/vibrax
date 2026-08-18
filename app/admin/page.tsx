'use client'
// 관리자 대시보드 — KPI(7일 증감) · 추이 · 최근 게임/가입 · 바로가기
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { DashboardStats, AdminMember, GameWithCreator } from '@/lib/supabase/types'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, SectionTitle, Avatar, Badge, Skeleton, btn } from '@/components/admin/ui'

const fmt = (n: number) => n.toLocaleString()
const dayLabel = (d: string) => { const x = new Date(d); return `${x.getMonth() + 1}/${x.getDate()}` }
const rel = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.round(h / 24)}일 전` }

function Kpi({ label, value, series, accent = '#2563eb', href }: { label: string; value: number; series?: number[]; accent?: string; href?: string }) {
  const last7 = series ? series.slice(-7).reduce((a, b) => a + b, 0) : null
  const prev7 = series ? series.slice(-14, -7).reduce((a, b) => a + b, 0) : null
  const delta = last7 != null && prev7 != null && last7 + prev7 >= 5 ? (prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0) : null
  const inner = (
    <div className="rounded-2xl border border-[#ebe4d6] bg-white p-5 shadow-[0_1px_2px_rgba(36,31,23,0.04),0_8px_24px_-16px_rgba(36,31,23,0.18)] h-full hover:border-[#cfc4ab] transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#857a68]">{label}</p>
        {delta != null && <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{delta >= 0 ? '+' : ''}{delta}%</span>}
      </div>
      <p className="text-[28px] leading-none font-extrabold tracking-tight mt-3" style={{ color: accent }}>{fmt(value)}</p>
      {last7 != null && <p className="text-[11.5px] text-[#9d9280] mt-2">최근 7일 +{fmt(last7)}</p>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState(false)
  const [recentGames, setRecentGames] = useState<GameWithCreator[] | null>(null)
  const [topGames, setTopGames] = useState<GameWithCreator[] | null>(null)
  const [recentMembers, setRecentMembers] = useState<AdminMember[] | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats' as never).then(({ data, error }) => {
      if (error || !data) { console.error('[admin]', error); setError(true) } else setStats(data as unknown as DashboardStats)
    })
    supabase.from('games').select('*, profiles(username, agent_name, avatar_config)').order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setRecentGames((data as unknown as GameWithCreator[] | null) ?? []))
    supabase.from('games').select('*, profiles(username, agent_name, avatar_config)').order('view_count', { ascending: false }).limit(5)
      .then(({ data }) => setTopGames((data as unknown as GameWithCreator[] | null) ?? []))
    supabase.rpc('admin_list_members' as never, { p_query: null } as never).then(({ data }) => setRecentMembers(((data as unknown as AdminMember[] | null) ?? []).slice(0, 6)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <p className="text-red-500 text-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3">{a.loadFailed}</p>

  const t = stats?.totals
  const daily = stats?.daily ?? []
  const labels = daily.map(d => dayLabel(d.day))
  const today = new Date()
  const greeting = today.getHours() < 12 ? '좋은 아침이에요' : today.getHours() < 18 ? '좋은 오후예요' : '좋은 저녁이에요'

  return (
    <div>
      <PageHeader title={a.dashHeading} desc={`${greeting} · ${today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} 기준`}
        actions={<>
          <Link href="/admin/blog/new" className={btn.ghost}>새 글</Link>
          <Link href="/admin/notices" className={btn.ghost}>공지</Link>
          <Link href="/aj" className={btn.primary}>AJ 랭킹</Link>
        </>} />

      {!stats ? <Skeleton rows={4} /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <Kpi label={a.statMembers} value={t!.members} series={daily.map(d => d.signups)} href="/admin/members" />
            <Kpi label={a.statGames} value={t!.games} series={daily.map(d => d.games)} accent="#059669" href="/admin/games" />
            <Kpi label={a.statViews} value={t!.game_views} accent="#7c3aed" />
            <Kpi label={a.statGenerations} value={t!.generations} series={daily.map(d => d.generations)} accent="#0891b2" href="/admin/costs" />
            <Kpi label={a.statPurchased} value={t!.credits_purchased} accent="#f59e0b" />
            <Kpi label={a.statSpent} value={t!.credits_spent} accent="#e11d48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            <TrendChart label={a.chartSignups} sub={a.last30} values={daily.map(d => d.signups)} labels={labels} />
            <TrendChart label={a.chartGames} sub={a.last30} values={daily.map(d => d.games)} labels={labels} color="#059669" />
            <TrendChart label={a.chartGenerations} sub={a.last30} values={daily.map(d => d.generations)} labels={labels} color="#0891b2" />
            <TrendChart label={a.chartPurchases} sub={a.last30} values={daily.map(d => d.purchases)} labels={labels} color="#f59e0b" />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 최근 등록 게임 */}
        <Card className="xl:col-span-2 overflow-hidden">
          <SectionTitle right={<Link href="/admin/games" className="hover:text-[#2563eb]">전체 보기 →</Link>}>최근 등록 게임</SectionTitle>
          {recentGames === null ? <Skeleton rows={4} /> : recentGames.length === 0 ? <p className="p-6 text-[13px] text-[#857a68]">아직 게임이 없어요.</p> : (
            <ul className="divide-y divide-[#f0eadf]">
              {recentGames.map(g => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#faf8f3] transition-colors">
                  <span className="relative w-16 h-10 rounded-md overflow-hidden bg-gray-900 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#241f17] truncate">{g.title}</p>
                    <p className="text-[12px] text-[#9d9280] truncate">{g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown'} · {T.genres[g.genre]} · {rel(g.created_at)}</p>
                  </div>
                  <span className="text-[12px] text-[#857a68] tabular-nums shrink-0">👁 {fmt(g.view_count ?? 0)}</span>
                  <Link href={`/aj/${g.id}`} className="text-[11.5px] font-semibold text-[#2563eb] hover:underline shrink-0">AJ</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 최근 가입 */}
        <Card className="overflow-hidden">
          <SectionTitle right={<Link href="/admin/members" className="hover:text-[#2563eb]">전체 보기 →</Link>}>최근 가입 회원</SectionTitle>
          {recentMembers === null ? <Skeleton rows={4} /> : (
            <ul className="divide-y divide-[#f0eadf]">
              {recentMembers.map(m => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar url={m.avatar_url} name={m.username || m.email} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#241f17] truncate">{m.username}</p>
                    <p className="text-[11.5px] text-[#9d9280] truncate">{m.email}</p>
                  </div>
                  {m.role === 'admin' ? <Badge color={m.admin_role_color ?? '#2563eb'}>{m.admin_role_name ?? a.roleAdmin}</Badge> : <span className="text-[11px] text-[#9d9280]">{rel(m.created_at)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 인기 게임 */}
        <Card className="xl:col-span-3 overflow-hidden">
          <SectionTitle right={<span>조회수 기준</span>}>인기 게임 TOP 5</SectionTitle>
          {topGames === null ? <Skeleton rows={3} /> : (
            <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#f0eadf]">
              {topGames.map((g, i) => (
                <Link key={g.id} href={`/games/${g.id}`} className="p-4 hover:bg-[#faf8f3] transition-colors">
                  <div className="relative rounded-lg overflow-hidden aspect-video bg-gray-900 mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    <span className={`absolute top-1.5 left-1.5 text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center ${i === 0 ? 'bg-[#f59e0b] text-white' : 'bg-white/90 text-[#241f17]'}`}>{i + 1}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#241f17] truncate">{g.title}</p>
                  <p className="text-[11.5px] text-[#9d9280]">👁 {fmt(g.view_count ?? 0)} · {T.genres[g.genre]}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
