'use client'
// LLMPilot — ChatGPT · Gemini · Claude · Perplexity 같은 AI 검색에 우리 게임이 잘 노출되도록 하는 점검·설정
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, SectionTitle, Skeleton, Toggle, Toast, btn, input, label as labelCls, th, td, trHover, Pager, usePager } from '@/components/admin/ui'

interface Data { settings: { allowUserBrowsing: boolean; allowTraining: boolean; siteSummary: string; audience: string }; checks: { key: string; label: string; ok: boolean; detail: string }[]; botAccess: { ua: string; status: number }[]; games: { id: string; title: string; genre: string; score: number; hasDesc: boolean; hasManual: boolean; hasTeaser: boolean; hasTeaserEn: boolean; views: number }[]; score: number }

export default function LlmPilotPage() {
  const [data, setData] = useState<Data | null>(null)
  const [summary, setSummary] = useState(''); const [aud, setAud] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = useCallback(async () => { const r = await fetch('/api/admin/llmpilot'); if (r.ok) { const j = await r.json(); setData(j); setSummary(j.settings.siteSummary); setAud(j.settings.audience) } }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const patch = async (b: Record<string, unknown>) => { const r = await fetch('/api/admin/llmpilot', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); if (r.ok) { say('저장했어요. robots/llms.txt 는 최대 10분 내 반영.'); load() } else say('실패') }
  const games = data?.games ?? []
  const pager = usePager([...games].sort((a, b) => a.score - b.score), 25)
  const header = <PageHeader title="LLMPilot" badge={<span className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white" style={{ background: '#059669' }}>AI Search Engine</span>} desc="ChatGPT · Gemini · Claude · Perplexity 가 답변할 때 우리 게임을 찾고 인용하도록 — 봇 접근 정책, LLM용 요약(llms.txt), 구조화 데이터, 게임 설명 완성도를 점검하고 바로 고쳐요." />
  if (!data) return <div>{header}<Skeleton rows={6} /></div>
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="AI 검색 준비도" value={`${data.score}%`} sub={`${data.checks.filter(c => c.ok).length}/${data.checks.length} 항목 통과`} accent={data.score >= 80 ? '#059669' : data.score >= 50 ? '#f59e0b' : '#dc2626'} />
        <StatCard label="게임 설명 60점↑" value={games.filter(g => g.score >= 60).length} sub={`전체 ${games.length}개`} accent="#2563eb" />
        <StatCard label="사용자 브라우징 봇" value={data.settings.allowUserBrowsing ? '허용' : '차단'} sub="ChatGPT-User · Claude-User · Perplexity-User" accent={data.settings.allowUserBrowsing ? '#059669' : '#dc2626'} />
        <StatCard label="학습 크롤러" value={data.settings.allowTraining ? '허용' : '차단'} sub="GPTBot · ClaudeBot · Google-Extended" accent={data.settings.allowTraining ? '#f59e0b' : '#059669'} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <Card className="overflow-hidden">
          <SectionTitle right={<button onClick={load} className={btn.ghost + ' !h-7'}>다시 점검</button>}>점검 결과</SectionTitle>
          <ul className="divide-y divide-[#eef0f4]">{data.checks.map(c => (
            <li key={c.key} className="flex items-start gap-3 px-4 py-2.5"><span className={`mt-0.5 w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 ${c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{c.ok ? '✓' : '!'}</span><div className="min-w-0"><p className="text-[13px] font-semibold text-[#1f2430]">{c.label}</p><p className="text-[12px] text-[#6b7280]">{c.detail}</p></div></li>
          ))}</ul>
        </Card>
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-3">봇 접근 정책</p>
            <div className="space-y-3">
              <Toggle checked={data.settings.allowUserBrowsing} onChange={v => patch({ allowUserBrowsing: v })} label="사용자 질문에 답하려고 페이지를 읽는 봇 허용 (ChatGPT-User · Claude-User · Perplexity-User) — 켜야 AI 답변에 우리 게임이 인용돼요" />
              <Toggle checked={data.settings.allowTraining} onChange={v => patch({ allowTraining: v })} label="모델 학습 크롤러 허용 (GPTBot · ClaudeBot · Google-Extended · CCBot) — 끄면 학습에는 안 쓰이지만 검색 인용에는 영향 없음" />
            </div>
            <p className="mt-3 text-[11.5px] text-[#9aa1ad]">검색 인덱서(Googlebot=Gemini · OAI-SearchBot=ChatGPT 검색 · Claude-SearchBot · PerplexityBot)는 항상 허용.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{data.botAccess.map(b => <span key={b.ua} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${b.status === 200 ? 'bg-emerald-50 text-emerald-700' : b.status === 403 ? 'bg-rose-50 text-rose-700' : 'bg-[#eef0f4] text-[#6b7280]'}`}>{b.ua} {b.status}</span>)}</div>
          </Card>
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-3">LLM 에게 보여줄 사이트 요약 (llms.txt)</p>
            <label className={labelCls}>한 문단 요약</label><textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} className={input + ' !h-auto py-2'} />
            <label className={labelCls + ' mt-3'}>대상 사용자</label><input value={aud} onChange={e => setAud(e.target.value)} className={input} />
            <div className="mt-3 flex items-center gap-2"><button onClick={() => patch({ siteSummary: summary, audience: aud })} className={btn.primary}>저장</button><a href="/llms.txt" target="_blank" rel="noreferrer" className={btn.ghost}>llms.txt 보기</a><a href="/llms-full.txt" target="_blank" rel="noreferrer" className={btn.ghost}>llms-full.txt</a><a href="/api/catalog" target="_blank" rel="noreferrer" className={btn.ghost}>JSON</a></div>
          </Card>
        </div>
      </div>
      <Card className="overflow-hidden">
        <SectionTitle right={<span>점수 = 설명 40 · 매뉴얼 30 · 티저 20 · 영문 티저 10 — 낮은 순</span>}>게임별 AI 노출 완성도</SectionTitle>
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr><th className={th}>게임</th><th className={th}>장르</th><th className={`${th} text-right`}>점수</th><th className={th}>설명</th><th className={th}>매뉴얼</th><th className={th}>티저</th><th className={th}>EN</th><th className={`${th} text-right`}>조회</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-[#eef0f4]">{pager.slice.map(g => (
            <tr key={g.id} className={trHover}>
              <td className={`${td} font-semibold text-[#1f2430]`}>{g.title}</td><td className={td}>{g.genre}</td>
              <td className={`${td} text-right`}><span className={`font-bold ${g.score >= 60 ? 'text-emerald-600' : g.score >= 30 ? 'text-amber-600' : 'text-rose-600'}`}>{g.score}</span></td>
              {[g.hasDesc, g.hasManual, g.hasTeaser, g.hasTeaserEn].map((v, i) => <td key={i} className={td}>{v ? <Badge color="#059669">있음</Badge> : <Badge color="#9aa1ad">없음</Badge>}</td>)}
              <td className={`${td} text-right tabular-nums`}>{g.views.toLocaleString()}</td>
              <td className={td}><Link href={`/admin/games`} className="text-[12px] text-[#2563eb] hover:underline">게임 관리에서 보완</Link></td>
            </tr>))}</tbody>
        </table><Pager {...pager} /></div>
      </Card>
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
