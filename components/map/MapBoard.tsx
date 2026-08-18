'use client'
// 지도보드 — 어디에서 개발·플레이가 뜨거운지: 세계 지도 핫스팟 + 도시/국가 랭킹 + 실시간 티커
import { useEffect, useMemo, useRef, useState } from 'react'
import WorldMap, { KIND_LABEL, countryName, flagOf, type HotPoint } from '@/components/map/WorldMap'
import { PageHeader, Card, Segmented, SectionTitle } from '@/components/admin/ui'

interface Data {
  days: number; total: number; kinds: Record<string, number>; points: HotPoint[]
  countries: { code: string; total: number; kinds: Record<string, number>; cities: number }[]
  recent: { kind: string; city: string | null; country: string | null; at: string }[]
}
const KIND_COLOR: Record<string, string> = { generate: '#2563eb', publish: '#7c3aed', play: '#f59e0b', signup: '#059669', visit: '#94a3b8', game: '#0891b2' }
const rel = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.round(h / 24)}일 전` }

export default function MapBoard() {
  const [days, setDays] = useState(7)
  const [kind, setKind] = useState<'all' | 'dev' | 'play' | 'games'>('all')
  const [state, setState] = useState<{ days: number; data: Data | null; err: string | null; missing?: boolean }>({ days: 0, data: null, err: null })
  const [focus, setFocus] = useState<string | null>(null)
  const [showCity, setShowCity] = useState(true)
  const [showCountry, setShowCountry] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const MAP_H = 720
  // 처음엔 한반도(가운데)가 보이도록 가로 스크롤을 중앙으로
  const data = state.days === days ? state.data : null
  useEffect(() => { const el = scrollRef.current; if (!el) return; const center = () => { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 }; center(); const t = setTimeout(center, 300); return () => clearTimeout(t) }, [data])

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
    const pick = (k: string) => kind === 'all' || (kind === 'dev' ? ['generate', 'publish', 'signup', 'game'].includes(k) : kind === 'games' ? k === 'game' : k === 'play')
    const pts = data.points.map(p => { const kinds = Object.fromEntries(Object.entries(p.kinds).filter(([k]) => pick(k))); const total = Object.values(kinds).reduce((a, b) => a + b, 0); return { ...p, kinds, total } }).filter(p => p.total > 0)
    const cs = data.countries.map(c => { const kinds = Object.fromEntries(Object.entries(c.kinds).filter(([k]) => pick(k))); const total = Object.values(kinds).reduce((a, b) => a + b, 0); return { ...c, kinds, total } }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
    const recent = data.recent.filter(r => pick(r.kind))
    return { pts, cs, recent, total: pts.reduce((a, p) => a + p.total, 0) }
  }, [data, kind])
  const maxCity = Math.max(1, ...(filtered?.pts.slice(0, 10).map(p => p.total) ?? [1]))
  const maxCountry = Math.max(1, ...(filtered?.cs.slice(0, 10).map(c => c.total) ?? [1]))

  return (
    <div>
      <PageHeader title="지도보드" desc="게시된 게임의 국가 설정 + 스튜디오 생성 · 게임 게시 · 플레이 · 가입이 발생한 위치(도시 단위, Vercel 지오 헤더 기반, IP 미저장). 활동 로그는 지금부터 쌓이며 1분마다 갱신."
        actions={<>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: '전체' }, { value: 'dev', label: '개발' }, { value: 'play', label: '플레이' }, { value: 'games', label: '게임 국가' }]} />
          <Segmented value={days} onChange={setDays} options={[{ value: 1, label: '24h' }, { value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 365, label: '1년' }]} />
        </>} />

      {state.err && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">
          {state.missing ? <>지도 데이터 테이블이 없습니다. Supabase SQL Editor 에서 <code>db/migrations/2026-08-18-geo-events.sql</code> 을 실행하면 이 시점부터 집계됩니다.</> : state.err}
        </div>
      )}

      {/* 지도 전면(좌우 여백 없음) + 가로 스크롤 + 데이터 박스 오버레이 */}
      <div className="relative left-1/2 -translate-x-1/2 w-[calc(100vw-var(--rail-w,0rem))] md:w-[calc(100vw-var(--rail-w,0rem)-2px)] border-y border-[#e3e6ec] bg-[#f4f5f8]">
        <div ref={scrollRef} className="relative overflow-x-auto overflow-y-hidden scrollbar-hide" style={{ height: MAP_H }}>
          {filtered ? <WorldMap points={filtered.pts} focus={focus} heightPx={MAP_H} /> : <div className="absolute inset-0 flex items-center justify-center text-[#9aa1ad] text-[13px]">불러오는 중…</div>}
        </div>
        {filtered && filtered.pts.length === 0 && !state.err && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="rounded-md bg-white/90 border border-[#e3e6ec] px-4 py-2 text-[13px] text-[#6b7280]">이 기간에 기록된 활동이 없습니다.</p></div>
        )}

        {/* 좌상단 — KPI 칩 */}
        <div className="absolute top-3 left-4 right-4 xl:right-auto flex flex-wrap gap-1.5 pointer-events-none">
          {[['총 활동', filtered?.total ?? data?.total ?? 0, '#1f2430'], ['개발(생성)', data?.kinds.generate ?? 0, KIND_COLOR.generate], ['게임 게시', data?.kinds.publish ?? 0, KIND_COLOR.publish], ['플레이', data?.kinds.play ?? 0, KIND_COLOR.play], ['가입', data?.kinds.signup ?? 0, KIND_COLOR.signup], ['게시 게임', data?.kinds.game ?? 0, KIND_COLOR.game], ['활동 도시', filtered?.pts.length ?? 0, '#1f2430']].map(([l, v, c]) => (
            <div key={l as string} className="rounded-md bg-white/92 backdrop-blur border border-[#e3e6ec] px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">{l}</p>
              <p className="text-[16px] leading-none font-bold tracking-tight mt-0.5" style={{ color: c as string }}>{(v as number).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* 좌하단 — 범례 + 스크롤 안내 */}
        <div className="absolute bottom-3 left-4 flex items-center flex-wrap gap-3 rounded-md bg-white/85 backdrop-blur border border-[#e3e6ec] px-3 py-1.5 text-[11px] text-[#6b7280]">
          {Object.entries(KIND_LABEL).filter(([k]) => k !== 'visit').map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k] }} />{l}</span>)}
          <span className="text-[#9aa1ad]">· 좌우로 스크롤해 전체 지도 보기</span>
        </div>

        {/* 우측 — 도시/국가 패널 (접기 가능, 데스크톱) */}
        <div className="hidden xl:flex absolute top-3 right-4 bottom-3 w-[290px] flex-col gap-2 pointer-events-none">
          <div className={`pointer-events-auto rounded-lg bg-white/95 backdrop-blur border border-[#e3e6ec] overflow-hidden flex flex-col ${showCity ? 'flex-1 min-h-0' : ''}`}>
            <button onClick={() => setShowCity(v => !v)} className="flex items-center justify-between px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#1f2430] hover:bg-[#f7f8fa]"><span>도시 TOP 10</span><span className="text-[#9aa1ad]">{showCity ? '−' : '+'}</span></button>
            {showCity && <ol className="px-3 pb-3 space-y-2 overflow-y-auto scrollbar-hide border-t border-[#e3e6ec] pt-2">
              {(filtered?.pts ?? []).slice(0, 10).map((p, i) => (
                <li key={p.key} onMouseEnter={() => setFocus(p.key)} onMouseLeave={() => setFocus(null)} className="cursor-default">
                  <div className="flex items-center gap-2 text-[12.5px]"><span className="w-4 text-[10.5px] font-bold text-[#9aa1ad]">{i + 1}</span><span className="flex-1 truncate text-[#1f2430]">{flagOf(p.country)} {p.city ?? countryName(p.country)}{p.recent ? <span className="ml-1 text-[9.5px] font-semibold text-emerald-600">24h</span> : null}</span><span className="text-[#6b7280] tabular-nums">{p.total.toLocaleString()}</span></div>
                  <div className="h-1 rounded-full bg-[#eef0f4] mt-0.5 ml-6 overflow-hidden"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(p.total / maxCity) * 100}%` }} /></div>
                </li>
              ))}
              {filtered && filtered.pts.length === 0 && <li className="text-[12px] text-[#9aa1ad]">데이터 없음</li>}
            </ol>}
          </div>
          <div className={`pointer-events-auto rounded-lg bg-white/95 backdrop-blur border border-[#e3e6ec] overflow-hidden flex flex-col ${showCountry ? 'max-h-[46%]' : ''}`}>
            <button onClick={() => setShowCountry(v => !v)} className="flex items-center justify-between px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#1f2430] hover:bg-[#f7f8fa]"><span>국가별</span><span className="text-[#9aa1ad]">{showCountry ? '−' : '+'}</span></button>
            {showCountry && <ol className="px-3 pb-3 space-y-1.5 overflow-y-auto scrollbar-hide border-t border-[#e3e6ec] pt-2">
              {(filtered?.cs ?? []).slice(0, 10).map(c => (
                <li key={c.code} className="flex items-center gap-2 text-[12.5px]"><span className="text-[14px] leading-none">{flagOf(c.code)}</span><span className="flex-1 truncate text-[#1f2430]">{countryName(c.code)}</span><span className="w-14 h-1 rounded-full bg-[#eef0f4] overflow-hidden"><span className="block h-full bg-[#f59e0b]" style={{ width: `${(c.total / maxCountry) * 100}%` }} /></span><span className="text-[#6b7280] tabular-nums w-8 text-right">{c.total.toLocaleString()}</span></li>
              ))}
              {filtered && filtered.cs.length === 0 && <li className="text-[12px] text-[#9aa1ad]">데이터 없음</li>}
            </ol>}
          </div>
        </div>
      </div>

      {/* 모바일/태블릿: 패널을 아래에 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:hidden gap-3 mt-4">
        <Card><SectionTitle>도시 TOP 10</SectionTitle><ol className="p-4 space-y-2">{(filtered?.pts ?? []).slice(0, 10).map((p, i) => <li key={p.key} className="flex items-center gap-2 text-[13px]"><span className="w-5 text-[11px] font-bold text-[#9d9280]">{i + 1}</span><span className="flex-1 truncate">{flagOf(p.country)} {p.city ?? countryName(p.country)}</span><span className="text-[#6b6152] tabular-nums">{p.total}</span></li>)}</ol></Card>
        <Card><SectionTitle>국가별</SectionTitle><ol className="p-4 space-y-2">{(filtered?.cs ?? []).slice(0, 10).map(c => <li key={c.code} className="flex items-center gap-2 text-[13px]"><span>{flagOf(c.code)}</span><span className="flex-1 truncate">{countryName(c.code)}</span><span className="text-[#6b6152] tabular-nums">{c.total}</span></li>)}</ol></Card>
      </div>

      {/* 최근 활동 */}
      <Card className="mt-4">
        <SectionTitle>최근 활동</SectionTitle>
        <ul className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1.5">
          {(filtered?.recent ?? []).slice(0, 24).map((r, i) => (
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
  )
}
