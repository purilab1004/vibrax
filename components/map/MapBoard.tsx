'use client'
// 지도보드 — 어디에서 개발·플레이가 뜨거운지: 세계 지도 핫스팟 + 도시/국가 랭킹 + 실시간 티커
import { useEffect, useMemo, useState } from 'react'
import WorldMap, { KIND_LABEL, countryName, flagOf, type HotPoint } from '@/components/map/WorldMap'

interface Data {
  days: number; total: number; kinds: Record<string, number>; points: HotPoint[]
  countries: { code: string; total: number; kinds: Record<string, number>; cities: number }[]
  recent: { kind: string; city: string | null; country: string | null; at: string }[]
}
const KIND_COLOR: Record<string, string> = { generate: '#22d3ee', publish: '#a78bfa', play: '#fbbf24', signup: '#34d399', visit: '#94a3b8' }
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
    return { pts, cs, recent, total: pts.reduce((a, p) => a + p.total, 0) + 0 }
  }, [data, kind])

  const seg = (v: typeof kind, label: string) => <button onClick={() => setKind(v)} className={`h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors ${kind === v ? 'bg-white text-[#0b1020]' : 'text-white/60 hover:text-white'}`}>{label}</button>
  const maxCity = Math.max(1, ...(filtered?.pts.slice(0, 10).map(p => p.total) ?? [1]))
  const maxCountry = Math.max(1, ...(filtered?.cs.slice(0, 10).map(c => c.total) ?? [1]))

  return (
    <div className="rounded-3xl bg-[#070b17] text-white overflow-hidden">
      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10">
        {/* 헤더 */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div>
            <p className="font-pixel text-[11px] tracking-[0.3em] text-[#22d3ee]">LIVE MAP BOARD</p>
            <h1 className="text-[28px] md:text-[38px] font-extrabold tracking-tight leading-tight mt-1">지금 어디에서 <span className="bg-gradient-to-r from-[#22d3ee] via-[#a78bfa] to-[#fbbf24] bg-clip-text text-transparent">게임이 만들어지고 있을까?</span></h1>
            <p className="text-[13px] text-white/50 mt-1.5">스튜디오 생성 · 게임 게시 · 플레이 · 가입이 일어난 위치를 도시 단위로 모아 보여줘요. IP는 저장하지 않고 위치만 기록합니다.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-lg bg-white/10 p-1 gap-0.5">{seg('all', '전체')}{seg('dev', '개발')}{seg('play', '플레이')}</div>
            <div className="inline-flex items-center rounded-lg bg-white/10 p-1 gap-0.5">
              {[1, 7, 30, 365].map(d => <button key={d} onClick={() => setDays(d)} className={`h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors ${days === d ? 'bg-white text-[#0b1020]' : 'text-white/60 hover:text-white'}`}>{d === 1 ? '24h' : d === 365 ? '1년' : `${d}일`}</button>)}
            </div>
          </div>
        </div>

        {state.err && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-200 text-[13px] px-5 py-4">
            {state.missing ? <>아직 지도 데이터 테이블이 없어요. Supabase SQL Editor 에서 <code>db/migrations/2026-08-18-geo-events.sql</code> 을 실행하면 이 순간부터 위치가 쌓여요.</> : state.err}
          </div>
        )}

        {/* KPI 스트립 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {[
            ['활동', filtered?.total ?? data?.total ?? 0, '#fff'],
            ['개발(생성)', data?.kinds.generate ?? 0, KIND_COLOR.generate],
            ['게임 게시', data?.kinds.publish ?? 0, KIND_COLOR.publish],
            ['플레이', data?.kinds.play ?? 0, KIND_COLOR.play],
            ['활동 도시', filtered?.pts.length ?? 0, '#fff'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3">
              <p className="text-[11px] text-white/50">{l}</p>
              <p className="text-[22px] font-extrabold tracking-tight" style={{ color: c as string }}>{(v as number).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          {/* 지도 */}
          <div className="self-start rounded-3xl bg-gradient-to-b from-[#0b1226] to-[#070b17] border border-white/10 overflow-hidden relative shadow-[0_30px_80px_-30px_rgba(34,211,238,0.25)]">
            <div className="hidden md:flex absolute top-4 left-4 z-10 gap-3 text-[11px] text-white/60 flex-wrap">
              {Object.entries(KIND_LABEL).filter(([k]) => k !== 'visit').map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k], boxShadow: `0 0 8px ${KIND_COLOR[k]}` }} />{l}</span>)}
            </div>
            {filtered ? <WorldMap points={filtered.pts} focus={focus} /> : <div className="aspect-[1000/400] flex items-center justify-center text-white/40 text-[13px]">지도를 불러오는 중…</div>}
            <div className="md:hidden flex gap-3 text-[11px] text-white/60 flex-wrap px-4 py-3 border-t border-white/10">
              {Object.entries(KIND_LABEL).filter(([k]) => k !== 'visit').map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k] }} />{l}</span>)}
            </div>
            {filtered && filtered.pts.length === 0 && !state.err && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="rounded-full bg-black/50 px-4 py-2 text-[13px] text-white/70">이 기간엔 기록된 활동이 없어요. 스튜디오에서 게임을 만들거나 플레이하면 여기에 불이 켜져요.</p></div>
            )}
          </div>

          {/* 사이드 패널 */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
              <p className="text-[12px] font-bold text-white/80 mb-3">핫한 도시 TOP 10</p>
              <ol className="space-y-2">
                {(filtered?.pts ?? []).slice(0, 10).map((p, i) => (
                  <li key={p.key} onMouseEnter={() => setFocus(p.key)} onMouseLeave={() => setFocus(null)} className="cursor-default">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className={`w-5 text-[11px] font-bold ${i < 3 ? 'text-[#fbbf24]' : 'text-white/40'}`}>{i + 1}</span>
                      <span className="flex-1 truncate">{flagOf(p.country)} {p.city ?? countryName(p.country)}{p.recent ? <span className="ml-1.5 text-[10px] text-[#34d399]">● live</span> : null}</span>
                      <span className="text-white/60 tabular-nums">{p.total.toLocaleString()}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 mt-1 ml-7 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa]" style={{ width: `${(p.total / maxCity) * 100}%` }} /></div>
                  </li>
                ))}
                {filtered && filtered.pts.length === 0 && <li className="text-[12px] text-white/40">아직 없음</li>}
              </ol>
            </section>
            <section className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
              <p className="text-[12px] font-bold text-white/80 mb-3">국가별</p>
              <ol className="space-y-1.5">
                {(filtered?.cs ?? []).slice(0, 10).map(c => (
                  <li key={c.code} className="flex items-center gap-2 text-[13px]">
                    <span className="text-[16px] leading-none">{flagOf(c.code)}</span>
                    <span className="flex-1 truncate">{countryName(c.code)} <span className="text-white/40 text-[11px]">· {c.cities}개 도시</span></span>
                    <span className="w-16 h-1 rounded-full bg-white/10 overflow-hidden"><span className="block h-full bg-[#fbbf24]" style={{ width: `${(c.total / maxCountry) * 100}%` }} /></span>
                    <span className="text-white/60 tabular-nums w-10 text-right">{c.total.toLocaleString()}</span>
                  </li>
                ))}
                {filtered && filtered.cs.length === 0 && <li className="text-[12px] text-white/40">아직 없음</li>}
              </ol>
            </section>
            <section className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
              <p className="text-[12px] font-bold text-white/80 mb-3">실시간</p>
              <ul className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
                {(filtered?.recent ?? []).slice(0, 25).map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_COLOR[r.kind], boxShadow: `0 0 6px ${KIND_COLOR[r.kind]}` }} />
                    <span className="flex-1 truncate"><span className="text-white/90">{KIND_LABEL[r.kind] ?? r.kind}</span> <span className="text-white/50">· {flagOf(r.country)} {r.city ?? countryName(r.country)}</span></span>
                    <span className="text-white/40 text-[11px] whitespace-nowrap">{rel(r.at)}</span>
                  </li>
                ))}
                {filtered && filtered.recent.length === 0 && <li className="text-[12px] text-white/40">아직 없음</li>}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
