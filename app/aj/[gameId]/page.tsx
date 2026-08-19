// /aj/[gameId] — 이 게임을 운영하는 AJ의 대시보드
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectGameMetrics } from '@/lib/aj/metrics'
import AjDashboard from '@/components/aj/AjDashboard'
import type { AjReport } from '@/app/api/aj/analyze/route'
import { titleFont } from '@/lib/fonts'
import { avatarPreviewUrl } from '@/lib/jeumto/config'

export const dynamic = 'force-dynamic'

export default async function AjGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  const admin = createAdminClient()
  const supabase = await createClient()
  const [{ data: game }, { data: { user } }] = await Promise.all([
    admin.from('games').select('id,title,genre,thumbnail_url,user_id,studio_project_id,profiles(username,agent_name,avatar_config)').eq('id', gameId).maybeSingle(),
    supabase.auth.getUser(),
  ])
  const g = game as unknown as { id: string; title: string; genre: string; thumbnail_url: string; user_id: string; studio_project_id: string | null; profiles: { username: string | null; agent_name: string | null; avatar_config: unknown } | null } | null
  if (!g) return <div className="max-w-5xl mx-auto px-6 py-16 text-[#857a68]">게임을 찾을 수 없어요.</div>
  let isAdmin = false
  if (user) { const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(); isAdmin = (p as { role?: string } | null)?.role === 'admin' }
  const canRun = !!user && (user.id === g.user_id || isAdmin)
  const [metrics, { data: rep }] = await Promise.all([
    collectGameMetrics(admin, gameId, 30),
    admin.from('aj_reports').select('report,created_at').eq('game_id', gameId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const r = rep as { report: AjReport; created_at: string } | null
  const creator = g.profiles?.agent_name ?? g.profiles?.username ?? 'unknown'
  const ajName = g.profiles?.agent_name ?? `AJ ${creator}`
  const avatar = avatarPreviewUrl(g.profiles?.avatar_config)
  return (
    <div className="relative overflow-hidden">
      {/* 히어로 — 게임 썸네일 블러 배경 + AJ 아바타 */}
      <div className="relative">
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#fcfaf5]/40 via-[#fcfaf5]/70 to-[#fcfaf5]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-6">
          <Link href="/profile#games" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b6152] hover:text-[#2563eb]"><span aria-hidden>←</span> 내 게임</Link>
          <div className="mt-5 flex flex-col md:flex-row md:items-end gap-5">
            <div className="relative w-full md:w-72 aspect-video rounded-2xl overflow-hidden bg-gray-900 shadow-[0_20px_50px_-20px_rgba(36,31,23,0.45)] ring-1 ring-black/5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
              <span className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[10.5px] font-bold px-2 py-0.5 tracking-wide">{g.genre.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="avatar-ring shrink-0"><span className="avatar-wave w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="avatar-bob w-full h-full object-cover object-top" />
                  ) : <span className="text-[13px] font-bold text-[#2563eb]">{creator.charAt(0).toUpperCase()}</span>}
                </span></span>
                <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">{ajName.toUpperCase()} · AI GAME ENTREPRENEUR</p>
              </div>
              <h1 className={`${titleFont.className} mt-2 text-[34px] md:text-[46px] leading-[1.05] text-[#241f17]`}>{g.title}</h1>
              <p className="mt-2 text-[13px] text-[#6b6152]">by {creator}</p>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Link href={`/games/${g.id}`} className="inline-flex items-center h-9 px-4 rounded-lg bg-white border border-[#ddd3bf] text-[13px] font-semibold text-[#241f17] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">게임 보기</Link>
                {g.studio_project_id && canRun && <Link href={`/studio/${g.studio_project_id}`} className="inline-flex items-center h-9 px-4 rounded-lg bg-white border border-[#ddd3bf] text-[13px] font-semibold text-[#241f17] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">스튜디오에서 수정</Link>}
                {canRun && <Link href={`/ads?game=${g.id}`} className="inline-flex items-center h-9 px-4 rounded-lg bg-white border border-[#ddd3bf] text-[13px] font-semibold text-[#241f17] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">AJ에게 홍보 맡기기</Link>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <AjDashboard gameId={g.id} projectId={g.studio_project_id} canRun={canRun} initialMetrics={metrics} initialReport={r?.report ?? null} reportAt={r?.created_at ?? null} />
      </div>
    </div>
  )
}
