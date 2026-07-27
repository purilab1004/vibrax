'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { DashboardStats } from '@/lib/supabase/types'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.rpc('admin_dashboard_stats' as never).then(({ data, error }) => {
      if (error || !data) {
        console.error('[admin]', error)
        setError(true)
      } else {
        setStats(data as unknown as DashboardStats)
      }
    })
  }, [])

  if (error) return <p className="text-red-400 text-sm border border-red-900 bg-red-900/20 px-3 py-2">{a.loadFailed}</p>
  if (!stats) return <p className="font-pixel text-xs text-[#6b6152] tracking-widest">{a.loading}</p>

  const t = stats.totals
  const daily = stats.daily
  return (
    <div>
      <h1 className="font-pixel text-[#0284c7] text-base tracking-widest mb-8">{a.dashHeading}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label={a.statMembers} value={t.members} />
        <StatCard label={a.statGames} value={t.games} />
        <StatCard label={a.statViews} value={t.game_views} />
        <StatCard label={a.statGenerations} value={t.generations} />
        <StatCard label={a.statPurchased} value={t.credits_purchased} />
        <StatCard label={a.statSpent} value={t.credits_spent} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart label={a.chartSignups} sub={a.last30} values={daily.map(d => d.signups)} />
        <TrendChart label={a.chartGames} sub={a.last30} values={daily.map(d => d.games)} />
        <TrendChart label={a.chartGenerations} sub={a.last30} values={daily.map(d => d.generations)} color="#4da3ff" />
        <TrendChart label={a.chartPurchases} sub={a.last30} values={daily.map(d => d.purchases)} color="#c9940c" />
      </div>
    </div>
  )
}
