'use client'
// 접속 관리 — 페이지 뷰/세션/로그인 사용자 추이, 현재 접속, 페이지·리퍼러·기기·브라우저·국가, 최근 접속 회원
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, SectionTitle, Segmented, Skeleton, Avatar, Badge, th, td, trHover } from '@/components/admin/ui'
import { flagOf, countryName } from '@/components/map/WorldMap'

interface KV { k: string; v: number }
interface Data { days: number; pv: number; sessions: number; users: number; online: number; onlineUsers: number; byDay: { day: string; pv: number; sessions: number; users: number }[]; pages: KV[]; referrers: KV[]; devices: KV[]; browsers: KV[]; oss: KV[]; countries: KV[]; recentUsers: { id: string; at: string; path: string; country: string | null; device: string | null; browser: string | null; name: string; avatar: string | null; role: string }[]; recent: { session_id: string | null; user_id: string | null; path: string; referrer: string | null; country: string | null; city: string | null; device: string | null; browser: string | null; os: string | null; created_at: string }[] }

const rel = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.round(h / 24)}일 전` }
function Bars({ items, color = '#2563eb', fmt = (k: string) => k }: { items: KV[]; color?: string; fmt?: (k: string) => string }) {
  const max = Math.max(1, ...items.map(i => i.v))
  return <ul className="p-4 space-y-2">{items.map(i => <li key={i.k}><div className="flex items-center justify-between text-[13px]"><span className="truncate text-[#1f2430]">{fmt(i.k)}</span><span className="tabular-nums text-[#6b7280] ml-3">{i.v.toLocaleString()}</span></div><div className="h-1 rounded-full bg-[#eef0f4] mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(i.v / max) * 100}%`, background: color }} /></div></li>)}{items.length === 0 && <li className="text-[12px] text-[#9aa1ad]">데이터 없음</li>}</ul>
}

export default function AdminAccessPage() {
  const [days, setDays] = useState(7)
  const [now, setNow] = useState(0)
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null; missing?: boolean }>({ days: 0, data: null, err: null })
  const data = state.days === days ? state.data : null
  const load = useCallback(async (d: number) => { const r = await fetch(`/api/admin/access?days=${d}`); const j = await r.json(); if (!r.ok) setState({ days: d, data: null, err: j.error, missing: j.missing }); else setState({ days: d, data: j, err: null }) }, [])
  useEffect(() => { const tick = () => { setNow(Date.now()); load(days) }; const t = setTimeout(tick, 0); const iv = setInterval(tick, 60_000); return () => { clearTimeout(t); clearInterval(iv) } }, [days, load])
  const header = <PageHeader title="접속 관리" desc="페이지 뷰·세션·로그인 사용자 추이와 현재 접속, 유입 경로·기기·국가, 회원별 최근 접속 (IP 미저장, 1분마다 갱신)."
    actions={<Segmented value={days} onChange={setDays} options={[{ value: 1, label: '24h' }, { value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]} />} />
  if (state.days === days && state.err) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{state.missing ? <>접속 로그 테이블이 없어요. <code>db/migrations/2026-08-18-logs.sql</code> 을 실행하세요.</> : state.err}</Card></div>
  if (!data) return <div>{header}<Skeleton rows={6} /></div>
  const labels = data.byDay.map(d => d.day.slice(5))
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        <StatCard label="현재 접속" value={data.online} sub={`로그인 ${data.onlineUsers}명 · 최근 5분`} accent="#059669" />
        <StatCard label="페이지 뷰" value={data.pv} />
        <StatCard label="세션(방문)" value={data.sessions} accent="#0891b2" />
        <StatCard label="로그인 사용자" value={data.users} accent="#7c3aed" />
        <StatCard label="PV / 세션" value={data.sessions ? (data.pv / data.sessions).toFixed(1) : '-'} accent="#f59e0b" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <TrendChart label="일별 페이지 뷰" values={data.byDay.map(d => d.pv)} labels={labels} />
        <TrendChart label="일별 세션" values={data.byDay.map(d => d.sessions)} labels={labels} color="#0891b2" />
        <TrendChart label="일별 로그인 사용자" values={data.byDay.map(d => d.users)} labels={labels} color="#7c3aed" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
        <Card><SectionTitle>인기 페이지</SectionTitle><Bars items={data.pages} /></Card>
        <Card><SectionTitle>유입 경로</SectionTitle><Bars items={data.referrers} color="#0891b2" /></Card>
        <Card><SectionTitle>기기 · 브라우저 · OS</SectionTitle><Bars items={[...data.devices, ...data.browsers, ...data.oss]} color="#7c3aed" /></Card>
        <Card><SectionTitle>국가</SectionTitle><Bars items={data.countries} color="#f59e0b" fmt={k => k === '(없음)' ? k : `${flagOf(k)} ${countryName(k)}`} /></Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <SectionTitle right={<Link href="/admin/members" className="hover:text-[#2563eb]">회원 관리 →</Link>}>회원별 최근 접속</SectionTitle>
          {data.recentUsers.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">데이터 없음</p> : (
            <ul className="divide-y divide-[#eef0f4] max-h-[460px] overflow-y-auto">{data.recentUsers.map(u => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <Avatar url={u.avatar} name={u.name} size={30} />
                <div className="flex-1 min-w-0"><p className="font-semibold text-[#1f2430] truncate">{u.name} {u.role === 'admin' && <Badge color="#e11d48">ADMIN</Badge>}</p><p className="text-[11px] text-[#9aa1ad] truncate">{u.path} · {flagOf(u.country)} {u.device} · {u.browser}</p></div>
                <span className={`text-[11px] whitespace-nowrap ${now - new Date(u.at).getTime() < 5 * 60_000 ? 'text-emerald-600 font-semibold' : 'text-[#9aa1ad]'}`}>{now - new Date(u.at).getTime() < 5 * 60_000 ? '● 접속 중' : rel(u.at)}</span>
              </li>))}</ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <SectionTitle>실시간 접속 로그</SectionTitle>
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto"><table className="w-full">
            <thead><tr><th className={th}>시각</th><th className={th}>경로</th><th className={th}>위치</th><th className={th}>기기</th><th className={th}>유입</th></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{data.recent.map((r, i) => (
              <tr key={i} className={trHover}><td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(r.created_at).toLocaleTimeString()}</td><td className={`${td} font-mono text-[12px] max-w-[200px] truncate`}>{r.path}{r.user_id ? <span className="ml-1 text-[#2563eb]">●</span> : ''}</td><td className={`${td} whitespace-nowrap`}>{flagOf(r.country)} {r.city ?? countryName(r.country)}</td><td className={`${td} whitespace-nowrap`}>{r.device} · {r.browser}</td><td className={`${td} max-w-[160px] truncate text-[#6b7280]`}>{r.referrer ? (() => { try { return new URL(r.referrer).hostname } catch { return r.referrer } })() : '-'}</td></tr>
            ))}</tbody></table></div>
        </Card>
      </div>
    </div>
  )
}
