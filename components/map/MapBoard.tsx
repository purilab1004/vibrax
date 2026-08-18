'use client'
// 지도보드 — 어디에서 개발·플레이가 뜨거운지: 세계 지도 핫스팟 + 도시/국가 랭킹 + 실시간 티커
import { useEffect, useMemo, useState } from 'react'
import WorldMap, { KIND_LABEL, countryName, flagOf, type HotPoint } from '@/components/map/WorldMap'
import { PageHeader, Card, Segmented, SectionTitle } from '@/components/admin/ui'
import StatCard from '@/components/admin/StatCard'

interface Data {
  days: number; total: number; kinds: Record<string, number>; points: HotPoint[]
  countries: { code: string; total: number; kinds: Record<string, number>; cities: number }[]
  recent: { kind: string; city: string | null; country: string | null; at: string }[]
}
const KIND_COLOR: Record<string, string> = { generate: '#2563eb', publish: '#7c3aed', play: '#f59e0b', signup: '#059669', visit: '#94a3b8' }
const rel = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.round(h / 24)}일 전` }

export default function MapBoard() {
  const [days, setDays] = useState(7)
  const [kind, setKind] = useState<'all' | 'dev' | 'play'>('all')
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null; missing?: boolean }>({ days: 0, data: null, err: null })
  const [focus, setFocus] = useState<string | null>(null)
  const data = state.days === days ? state.data : null

  useEffect(() => {
    let alive = true
    const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1' ? '&demo=1' : ''
    const go = () => fetch(`/api/map?days=${days}${demo}`).then(async r => { const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.error ?? String(r.status)), { missing: j.missing }); return j as Data })
      .then(d => { if (alive) setState({ days, data: d, err: null }) })
      .catch(e => { if (alive) setState({ days, data: null, err: e.message, missing: e.missing }) })
    const t = setTimeout(go, 0)
    const iv = setInterval(go, 60_000)  // 1분마다 갱신
    return () => { alive = false; clearTimeout(t); clearInterval(iv) }
  }, [days])

  // 종류 필터 적용 (개발 = generate+publish+signup, 플레이 = play)
  const filtered = useMemo(() => {
    if (!data) return null
    const pick = (k: string) => kind === 'all' || (kind === 'dev' ? ['generate', 'publish', 'signup'].includes(k) : k === 'play')
    const pts = data.points.map(p => { const kinds = Object.fromEntries(Object.entries(p.kinds).filter(([k]) => pick(k))); const total = Object.values(kinds).reduce((a, b) => a + b, 0); return { ...p, kinds, total } }).filter(p => p.total > 0)
    const cs = data.countries.map(c => { const kinds = Object.fromEntries(Object.entries(c.kinds).filter(([k]) => pick(k))); const total = Object.values(kinds).reduce((a, b) => a + b, 0); return { ...c, kinds, total } }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
    const recent = data.recent.filter(r => pick(r.kind))
    return { pts, cs, recent, total: pts.reduce((a, p) => a + p.total, 0) }
  }, [data, kind])
  const maxCity = Math.max(1, ...(filtered?.pts.slice(0, 10).map(p => p.total) ?? [1]))
  const maxCountry = Math.max(1, ...(filtered?.cs.slice(0, 10).map(c => c.total) ?? [1]))

  return (
    <div>
      <PageHeader title="지도보드" desc="스튜디오 생성 · 게임 게시 · 플레이 · 가입이 발생한 위치를 도시 단위로 집계합니다 (Vercel 지오 헤더 기반, IP 미저장). 1분마다 갱신."
        actions={<>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: '전체' }, { value: 'dev', label: '개발' }, { value: 'play', label: '플레이' }]} />
          <Segmented value={days} onChange={setDays} options={[{ value: 1, label: '24h' }, { value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 365, label: '1년' }]} />
        </>} />

      {state.err && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">
          {state.missing ? <>지도 데이터 테이블이 없습니다. Supabase SQL Editor 에서 <code>db/migrations/2026-08-18-geo-events.sql</code> 을 실행하면 이 시점부터 집계됩니다.</> : state.err}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="총 활동" value={filtered?.total ?? data?.total ?? 0} />
        <StatCard label="개발(생성)" value={data?.kinds.generate ?? 0} accent={KIND_COLOR.generate} />
        <StatCard label="게임 게시" value={data?.kinds.publish ?? 0} accent={KIND_COLOR.publish} />
        <StatCard label="플레이" value={data?.kinds.play ?? 0} accent={KIND_COLOR.play} />
        <StatCard label="활동 도시" value={filtered?.pts.length ?? 0} accent="#241f17" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden">
          <SectionTitle right={<span className="flex gap-3 flex-wrap">{Object.entries(KIND_LABEL).filter(([k]) => k !== 'visit').map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k] }} />{l}</span>)}</span>}>활동 지도</SectionTitle>
          <div className="relative bg-[#fbf9f4]">
            {filtered ? <WorldMap points={filtered.pts} focus={focus} /> : <div className="aspect-[1000/400] flex items-center justify-center text-[#9d9280] text-[13px]">불러오는 중…</div>}
            {filtered && filtered.pts.length === 0 && !state.err && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="rounded-lg bg-white/90 border border-[#ebe4d6] px-4 py-2 text-[13px] text-[#6b6152]">이 기간에 기록된 활동이 없습니다.</p></div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle>도시 TOP 10</SectionTitle>
            <ol className="p-4 space-y-2.5">
              {(filtered?.pts ?? []).slice(0, 10).map((p, i) => (
                <li key={p.key} onMouseEnter={() => setFocus(p.key)} onMouseLeave={() => setFocus(null)} className="cursor-default">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="w-5 text-[11px] font-bold text-[#9d9280]">{i + 1}</span>
                    <span className="flex-1 truncate text-[#241f17]">{flagOf(p.country)} {p.city ?? countryName(p.country)}{p.recent ? <span className="ml-1.5 text-[10px] font-semibold text-emerald-600">24h</span> : null}</span>
                    <span className="text-[#6b6152] tabular-nums">{p.total.toLocaleString()}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[#f1ece2] mt-1 ml-7 overflow-hidden"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(p.total / maxCity) * 100}%` }} /></div>
                </li>
              ))}
              {filtered && filtered.pts.length === 0 && <li className="text-[12px] text-[#9d9280]">데이터 없음</li>}
            </ol>
          </Card>
          <Card>
            <SectionTitle>국가별</SectionTitle>
            <ol className="p-4 space-y-2">
              {(filtered?.cs ?? []).slice(0, 10).map(c => (
                <li key={c.code} className="flex items-center gap-2 text-[13px]">
                  <span className="text-[15px] leading-none">{flagOf(c.code)}</span>
                  <span className="flex-1 truncate text-[#241f17]">{countryName(c.code)} <span className="text-[#9d9280] text-[11px]">· 도시 {c.cities}</span></span>
                  <span className="w-16 h-1 rounded-full bg-[#f1ece2] overflow-hidden"><span className="block h-full bg-[#f59e0b]" style={{ width: `${(c.total / maxCountry) * 100}%` }} /></span>
                  <span className="text-[#6b6152] tabular-nums w-10 text-right">{c.total.toLocaleString()}</span>
                </li>
              ))}
              {filtered && filtered.cs.length === 0 && <li className="text-[12px] text-[#9d9280]">데이터 없음</li>}
            </ol>
          </Card>
          <Card>
            <SectionTitle>최근 활동</SectionTitle>
            <ul className="p-4 space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
              {(filtered?.recent ?? []).slice(0, 25).map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_COLOR[r.kind] }} />
                  <span className="flex-1 truncate"><span className="text-[#241f17]">{KIND_LABEL[r.kind] ?? r.kind}</span> <span className="text-[#857a68]">· {flagOf(r.country)} {r.city ?? countryName(r.country)}</span></span>
                  <span className="text-[#9d9280] text-[11px] whitespace-nowrap">{rel(r.at)}</span>
                </li>
              ))}
              {filtered && filtered.recent.length === 0 && <li className="text-[12px] text-[#9d9280]">데이터 없음</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
