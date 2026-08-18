// /aj/[gameId] — 이 게임을 운영하는 AJ의 대시보드
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectGameMetrics } from '@/lib/aj/metrics'
import AjDashboard from '@/components/aj/AjDashboard'
import type { AjReport } from '@/app/api/aj/analyze/route'
import { titleFont } from '@/lib/fonts'

export const dynamic = 'force-dynamic'

export default async function AjGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  const admin = createAdminClient()
  const supabase = await createClient()
  const [{ data: game }, { data: { user } }] = await Promise.all([
    admin.from('games').select('id,title,genre,thumbnail_url,user_id,studio_project_id,profiles(username,agent_name)').eq('id', gameId).maybeSingle(),
    supabase.auth.getUser(),
  ])
  const g = game as unknown as { id: string; title: string; genre: string; thumbnail_url: string; user_id: string; studio_project_id: string | null; profiles: { username: string | null; agent_name: string | null } | null } | null
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
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/profile" className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] tracking-widest">← MY PAGE</Link>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-900 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-pixel text-[11px] tracking-[0.3em] text-[#2563eb]">{(g.profiles?.agent_name ?? `AJ ${creator}`).toUpperCase()} · AI GAME ENTREPRENEUR</p>
          <h1 className={`${titleFont.className} text-[28px] md:text-[36px] leading-tight text-[#241f17] truncate`}>{g.title}</h1>
          <p className="text-[12px] text-[#857a68]">by {creator} · {g.genre.toUpperCase()} · <Link href={`/games/${g.id}`} className="text-[#2563eb] hover:underline">게임 보기</Link>{g.studio_project_id && canRun && <> · <Link href={`/studio/${g.studio_project_id}`} className="text-[#2563eb] hover:underline">스튜디오</Link></>}</p>
        </div>
      </div>
      <div className="mt-8">
        <AjDashboard gameId={g.id} projectId={g.studio_project_id} canRun={canRun} initialMetrics={metrics} initialReport={r?.report ?? null} reportAt={r?.created_at ?? null} />
      </div>
    </div>
  )
}
