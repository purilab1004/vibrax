// 관리자 — AJ AdPilot 캠페인 전체 현황 (플랫폼 광고 수익 = 소진 코인)
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader, Card, Badge, SectionTitle, EmptyState, th, td, trHover } from '@/components/admin/ui'
import StatCard from '@/components/admin/StatCard'

export const dynamic = 'force-dynamic'

export default async function AdminAdsPage() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('ad_campaigns').select('*, games(id,title,thumbnail_url), profiles!ad_campaigns_advertiser_id_fkey(username,agent_name)').order('created_at', { ascending: false }).limit(300)
  const rows = (data ?? []) as { id: string; status: string; title: string | null; creative: { headline?: string }; budget_coins: number; spent_coins: number; cpc_coins: number; impressions: number; clicks: number; plays: number; coins_earned: number; auto: boolean; created_at: string; games: { id: string; title: string; thumbnail_url: string } | null; profiles: { username: string | null; agent_name: string | null } | null }[]
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const spent = sum(r => r.spent_coins), imps = sum(r => r.impressions), clicks = sum(r => r.clicks), plays = sum(r => r.plays), earned = sum(r => r.coins_earned)
  return (
    <div>
      <PageHeader title="AJ AdPilot" badge={<span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: '#a855f7' }}>Ad Engine</span>} desc="AJ가 운영하는 홍보 캠페인(의뢰) 현황. 클릭당 코인이 소진되고, 소진 코인이 플랫폼 광고 수익입니다." actions={<Link href="/ads" className="inline-flex items-center h-9 px-3.5 rounded-lg border border-[#d9dde5] bg-white text-[13px] font-medium text-[#374151] hover:border-[#2563eb] hover:text-[#2563eb]">캠페인 만들기 화면</Link>} />
      {error && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">{/does not exist|schema cache/i.test(error.message) ? <>광고 테이블이 없어요. <code>db/migrations/2026-08-18-ads.sql</code> 을 실행하세요.</> : error.message}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
        <StatCard label="캠페인" value={rows.length} sub={`진행 중 ${rows.filter(r => r.status === 'active').length}`} />
        <StatCard label="광고 수익(소진 코인)" value={spent} accent="#f59e0b" />
        <StatCard label="노출" value={imps} accent="#7c3aed" />
        <StatCard label="클릭" value={clicks} sub={imps ? `CTR ${(clicks / imps * 100).toFixed(1)}%` : '-'} accent="#2563eb" />
        <StatCard label="플레이 전환" value={plays} sub={clicks ? `CVR ${(plays / clicks * 100).toFixed(0)}%` : '-'} accent="#059669" />
        <StatCard label="광고주 획득 코인" value={earned} sub={spent ? `ROAS ${(earned / spent).toFixed(1)}×` : '-'} accent="#0891b2" />
      </div>
      <Card className="overflow-hidden">
        <SectionTitle>캠페인 목록</SectionTitle>
        {rows.length === 0 ? <EmptyState title="캠페인이 없어요" /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>캠페인</th><th className={th}>광고주</th><th className={th}>상태</th><th className={`${th} text-right`}>예산</th><th className={`${th} text-right`}>노출/클릭</th><th className={`${th} text-right`}>플레이</th><th className={`${th} text-right`}>획득</th><th className={th}>생성</th></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{rows.map(r => (
              <tr key={r.id} className={trHover}>
                <td className={td}><div className="flex items-center gap-2.5"><span className="w-12 h-8 rounded overflow-hidden bg-gray-900 shrink-0">{r.games && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.games.thumbnail_url} alt="" className="w-full h-full object-cover" />}</span><div className="min-w-0"><p className="font-semibold text-[#1f2430] truncate max-w-[240px]">{r.creative?.headline ?? r.title ?? '-'}</p><p className="text-[11px] text-[#9aa1ad] truncate">{r.games?.title}{r.auto ? ' · AJ 자동' : ''}</p></div></div></td>
                <td className={td}>{r.profiles?.agent_name ?? r.profiles?.username ?? '-'}</td>
                <td className={td}><Badge color={r.status === 'active' ? '#059669' : r.status === 'paused' ? '#f59e0b' : '#857a68'}>{r.status}</Badge></td>
                <td className={`${td} text-right tabular-nums`}>{r.spent_coins}/{r.budget_coins} <span className="text-[#9aa1ad]">@{r.cpc_coins}</span></td>
                <td className={`${td} text-right tabular-nums`}>{r.impressions}/{r.clicks}</td>
                <td className={`${td} text-right tabular-nums`}>{r.plays}</td>
                <td className={`${td} text-right tabular-nums`}>{r.coins_earned}</td>
                <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}
