// /admin/aj/[userId] — AJ(크리에이터) 상세: 어떤 게임·프로젝트·리포트·캠페인·방송을 만들었는지 한눈에
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { avatarPreviewUrl } from '@/lib/jeumto/config'
import { PageHeader, Card, SectionTitle, Badge, Avatar } from '@/components/admin/ui'
import { th, td, trHover } from '@/components/admin/tokens'
import StatCard from '@/components/admin/StatCard'
import { countryFlag } from '@/lib/country'

export const dynamic = 'force-dynamic'

const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`

export default async function AdminAjDetail({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const admin = createAdminClient()
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString()
  const [{ data: prof }, { data: games }, { data: projects }, { data: usage }, { data: reports }, { data: camps }, { data: pays }] = await Promise.all([
    admin.from('profiles').select('id,username,agent_name,country,avatar_config,role,created_at,vcoin').eq('id', userId).maybeSingle(),
    admin.from('games').select('id,title,genre,thumbnail_url,view_count,created_at,studio_project_id,coin_cost,country').eq('user_id', userId).order('created_at', { ascending: false }),
    admin.from('studio_projects').select('id,title,created_at,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(50),
    admin.from('llm_usage').select('kind,model,input_tokens,output_tokens,cost_usd,credits,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(2000),
    admin.from('aj_reports').select('game_id,report,created_at').eq('created_by', userId).order('created_at', { ascending: false }).limit(50),
    admin.from('ad_campaigns').select('id,game_id,title,creative,status,budget_coins,spent_coins,impressions,clicks,plays,coins_earned,created_at').eq('advertiser_id', userId).order('created_at', { ascending: false }),
    admin.from('payments').select('id,credits,amount_minor,currency,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ])
  const p = prof as { id: string; username: string | null; agent_name: string | null; country: string | null; avatar_config: unknown; role: string; created_at: string; vcoin: number } | null
  if (!p) return <p className="text-[13px] text-[#6b7280]">회원을 찾을 수 없어요.</p>
  const gs = (games ?? []) as { id: string; title: string; genre: string; thumbnail_url: string; view_count: number | null; created_at: string; studio_project_id: string | null; coin_cost: number | null; country: string | null }[]
  const gameIds = gs.map(g => g.id)
  const [{ data: sess }, { data: coins }, { data: versions }] = await Promise.all([
    gameIds.length ? admin.from('game_sessions').select('game_id,duration_sec,started_at').in('game_id', gameIds).gte('started_at', since7).limit(20000) : Promise.resolve({ data: [] }),
    gameIds.length ? admin.from('game_coin_events').select('game_id,coins,created_at').in('game_id', gameIds).limit(20000) : Promise.resolve({ data: [] }),
    admin.from('studio_versions').select('project_id,version').in('project_id', ((projects ?? []) as { id: string }[]).map(x => x.id)).limit(5000),
  ])
  const sessRows = (sess ?? []) as { game_id: string; duration_sec: number }[]
  const coinRows = (coins ?? []) as { game_id: string; coins: number; created_at: string }[]
  const verRows = (versions ?? []) as { project_id: string; version: number }[]
  const use = (usage ?? []) as { kind: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number; credits: number; created_at: string }[]
  const reps = (reports ?? []) as { game_id: string; report: { fun_score?: number; headline?: string }; created_at: string }[]
  const cs = (camps ?? []) as { id: string; game_id: string; title: string | null; creative: { headline?: string }; status: string; budget_coins: number; spent_coins: number; impressions: number; clicks: number; plays: number; coins_earned: number; created_at: string }[]
  const pay = (pays ?? []) as { id: string; credits: number; amount_minor: number | null; currency: string | null; status: string; created_at: string }[]
  const cfg = p.avatar_config as { broadcast?: { on?: boolean; mode?: string; gameId?: string }; broadcasts?: { on?: boolean; url?: string; gameId?: string }[]; name?: string } | null
  const totalCoins = coinRows.reduce((a, x) => a + x.coins, 0)
  const weekCoins = coinRows.filter(x => x.created_at >= since7).reduce((a, x) => a + x.coins, 0)
  const totalViews = gs.reduce((a, g) => a + (g.view_count ?? 0), 0)
  const cost = use.reduce((a, u) => a + Number(u.cost_usd), 0)
  const genCalls = use.filter(u => ['create', 'edit', 'template', 'template_edit'].includes(u.kind)).length
  const name = p.agent_name ?? `AJ ${p.username ?? ''}`
  const featureUse = {
    studio: (projects ?? []).length > 0, templates: use.some(u => u.kind === 'template' || u.kind === 'template_edit'), notes: use.some(u => u.kind === 'explain'), image: use.some(u => u.kind === 'from_image'),
    ajReport: reps.length > 0, ads: cs.length > 0, broadcast: !!(cfg?.broadcast?.on || cfg?.broadcasts?.some(b => b.on)) || !!(cfg?.broadcasts?.length), avatar: !!avatarPreviewUrl(p.avatar_config), publish: gs.length > 0, purchase: pay.length > 0,
  }
  const FEATURES: [keyof typeof featureUse, string][] = [['avatar', '점토 아바타'], ['studio', '스튜디오 제작'], ['templates', '템플릿 엔진'], ['notes', '학습 노트'], ['image', '사진→게임'], ['publish', '게임 게시'], ['broadcast', '방송(카메라/링크)'], ['ajReport', 'AJ 리포트'], ['ads', 'AJ AdPilot 캠페인'], ['purchase', '크레딧 결제']]

  return (
    <div>
      <Link href="/admin/aj" className="text-[12px] text-[#6b7280] hover:text-[#2563eb]">← AJ 랭킹</Link>
      <div className="mt-3 flex items-center gap-3 mb-4">
        <span className="avatar-ring"><span className="avatar-wave w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-white"><Avatar url={avatarPreviewUrl(p.avatar_config)} name={p.username ?? '?'} size={64} /></span></span>
        <div>
          <PageHeader title={name} desc={<>{countryFlag(p.country)} {p.username} · 가입 {new Date(p.created_at).toLocaleDateString()} · 게임 코인 {p.vcoin?.toLocaleString()} {p.role === 'admin' && <Badge color="#e11d48">ADMIN</Badge>}</>} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
        <StatCard label="게시 게임" value={gs.length} />
        <StatCard label="스튜디오 프로젝트" value={(projects ?? []).length} sub={`버전 ${verRows.length}개`} accent="#0891b2" />
        <StatCard label="총 조회" value={totalViews} accent="#7c3aed" />
        <StatCard label="코인 수익" value={totalCoins} sub={`7일 ${weekCoins}`} accent="#f59e0b" />
        <StatCard label="7일 플레이" value={sessRows.length} sub={sessRows.length ? `평균 ${fmtDur(Math.round(sessRows.reduce((a, s) => a + s.duration_sec, 0) / sessRows.length))}` : '-'} accent="#059669" />
        <StatCard label="LLM 원가" value={`$${cost.toFixed(2)}`} sub={`생성/수정 ${genCalls}회`} accent="#e11d48" />
      </div>

      {/* 구현/사용한 서비스 */}
      <Card className="p-5 mb-4">
        <p className="text-[14px] font-bold text-[#1f2430] mb-3">사용한 서비스</p>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map(([k, l]) => <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12.5px] font-semibold border ${featureUse[k] ? 'border-[#2563eb]/40 bg-[#2563eb]/5 text-[#1e40af]' : 'border-[#e3e6ec] text-[#c4b9a2]'}`}><span className={`w-1.5 h-1.5 rounded-full ${featureUse[k] ? 'bg-[#2563eb]' : 'bg-[#ddd3bf]'}`} />{l}</span>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <SectionTitle right={<span>{gs.length}개</span>}>게시한 게임</SectionTitle>
          {gs.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">없음</p> : (
            <table className="w-full"><thead><tr><th className={th}>게임</th><th className={`${th} text-right`}>조회</th><th className={`${th} text-right`}>코인</th><th className={`${th} text-right`}>7일 플레이</th><th className={th}>FUN</th><th className={th} /></tr></thead>
              <tbody className="divide-y divide-[#eef0f4]">
                {gs.map(g => { const r = reps.find(x => x.game_id === g.id); return (
                  <tr key={g.id} className={trHover}>
                    <td className={td}><div className="flex items-center gap-2.5"><span className="w-12 h-8 rounded overflow-hidden bg-gray-900 shrink-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" /></span><div className="min-w-0"><p className="font-semibold text-[#1f2430] truncate max-w-[220px]">{g.title}</p><p className="text-[11px] text-[#9aa1ad]">{g.genre.toUpperCase()} · {g.studio_project_id ? '스튜디오' : '업로드'} · {new Date(g.created_at).toLocaleDateString()}</p></div></div></td>
                    <td className={`${td} text-right tabular-nums`}>{(g.view_count ?? 0).toLocaleString()}</td>
                    <td className={`${td} text-right tabular-nums`}>{coinRows.filter(c => c.game_id === g.id).reduce((a, c) => a + c.coins, 0)}</td>
                    <td className={`${td} text-right tabular-nums`}>{sessRows.filter(s => s.game_id === g.id).length}</td>
                    <td className={td}>{r?.report?.fun_score != null ? <Badge color="#2563eb">FUN {r.report.fun_score}</Badge> : <span className="text-[#c4b9a2]">-</span>}</td>
                    <td className={td}><Link href={`/aj/${g.id}`} className="text-[12px] text-[#2563eb] hover:underline">대시보드</Link></td>
                  </tr>) })}
              </tbody></table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <SectionTitle right={<span>{(projects ?? []).length}개</span>}>스튜디오 프로젝트</SectionTitle>
          {(projects ?? []).length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">없음</p> : (
            <ul className="divide-y divide-[#eef0f4] max-h-[420px] overflow-y-auto">
              {((projects ?? []) as { id: string; title: string | null; created_at: string; updated_at: string }[]).map(pr => { const v = verRows.filter(x => x.project_id === pr.id).length; const pub = gs.find(g => g.studio_project_id === pr.id); return (
                <li key={pr.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <div className="flex-1 min-w-0"><p className="font-semibold text-[#1f2430] truncate">{pr.title || '제목 없음'}</p><p className="text-[11px] text-[#9aa1ad]">버전 {v} · 수정 {new Date(pr.updated_at).toLocaleDateString()}</p></div>
                  {pub ? <Badge color="#059669">게시됨</Badge> : <span className="text-[11px] text-[#9aa1ad]">미게시</span>}
                  <Link href={`/studio/${pr.id}`} className="text-[12px] text-[#2563eb] hover:underline">열기</Link>
                </li>) })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <SectionTitle right={<span>{cs.length}개</span>}>AJ AdPilot 캠페인</SectionTitle>
          {cs.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">없음</p> : (
            <table className="w-full"><thead><tr><th className={th}>캠페인</th><th className={th}>상태</th><th className={`${th} text-right`}>예산</th><th className={`${th} text-right`}>노출/클릭</th><th className={`${th} text-right`}>플레이</th><th className={`${th} text-right`}>획득</th></tr></thead>
              <tbody className="divide-y divide-[#eef0f4]">{cs.map(c => (
                <tr key={c.id} className={trHover}><td className={td}><p className="font-semibold text-[#1f2430] truncate max-w-[200px]">{c.creative?.headline ?? c.title ?? '-'}</p><p className="text-[11px] text-[#9aa1ad]">{gs.find(g => g.id === c.game_id)?.title ?? c.game_id.slice(0, 8)}</p></td><td className={td}><Badge color={c.status === 'active' ? '#059669' : c.status === 'paused' ? '#f59e0b' : '#857a68'}>{c.status}</Badge></td><td className={`${td} text-right tabular-nums`}>{c.spent_coins}/{c.budget_coins}</td><td className={`${td} text-right tabular-nums`}>{c.impressions}/{c.clicks}</td><td className={`${td} text-right tabular-nums`}>{c.plays}</td><td className={`${td} text-right tabular-nums`}>{c.coins_earned}</td></tr>
              ))}</tbody></table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <SectionTitle right={<span>{reps.length}건</span>}>AJ 리포트 · 방송 · 결제</SectionTitle>
          <div className="p-5 space-y-4 text-[13px]">
            <div>
              <p className="text-[12px] font-semibold text-[#6b7280] mb-1.5">최근 AJ 리포트</p>
              {reps.length === 0 ? <p className="text-[#9aa1ad]">없음</p> : <ul className="space-y-1">{reps.slice(0, 5).map((r, i) => <li key={i} className="flex items-center gap-2"><Badge color="#2563eb">FUN {r.report?.fun_score ?? '-'}</Badge><span className="truncate text-[#1f2430]">{r.report?.headline ?? gs.find(g => g.id === r.game_id)?.title}</span><span className="ml-auto text-[11px] text-[#9aa1ad] whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span></li>)}</ul>}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#6b7280] mb-1.5">방송 설정</p>
              {cfg?.broadcast?.on || cfg?.broadcasts?.length ? (
                <ul className="space-y-1">
                  {cfg.broadcast?.on && <li className="text-[#1f2430]">카메라 방송 · {cfg.broadcast.mode} · {gs.find(g => g.id === cfg.broadcast?.gameId)?.title ?? cfg.broadcast.gameId ?? '-'} <Badge color="#e11d48">ON AIR</Badge></li>}
                  {(cfg.broadcasts ?? []).map((b, i) => <li key={i} className="text-[#1f2430] truncate">링크 방송 · {gs.find(g => g.id === b.gameId)?.title ?? '-'} · <span className="text-[#6b7280]">{b.url}</span> {b.on ? <Badge color="#e11d48">ON</Badge> : <span className="text-[11px] text-[#9aa1ad]">off</span>}</li>)}
                </ul>
              ) : <p className="text-[#9aa1ad]">없음</p>}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#6b7280] mb-1.5">크레딧 결제</p>
              {pay.length === 0 ? <p className="text-[#9aa1ad]">없음</p> : <ul className="space-y-1">{pay.map(x => <li key={x.id} className="flex items-center gap-2"><span className="text-[#1f2430]">+{x.credits} 크레딧</span><span className="text-[#6b7280]">{x.amount_minor != null ? `${(x.amount_minor / 100).toFixed(2)} ${x.currency}` : ''}</span><Badge color={x.status === 'completed' ? '#059669' : '#e11d48'}>{x.status}</Badge><span className="ml-auto text-[11px] text-[#9aa1ad]">{new Date(x.created_at).toLocaleDateString()}</span></li>)}</ul>}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#6b7280] mb-1.5">LLM 사용 (종류별)</p>
              <div className="flex flex-wrap gap-1.5">{Object.entries(use.reduce<Record<string, number>>((a, u) => { a[u.kind] = (a[u.kind] ?? 0) + 1; return a }, {})).map(([k, n]) => <span key={k} className="rounded-full bg-[#f7f8fa] border border-[#e3e6ec] px-2.5 h-7 inline-flex items-center text-[12px]">{k} <b className="ml-1">{n}</b></span>)}{use.length === 0 && <span className="text-[#9aa1ad]">없음</span>}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
