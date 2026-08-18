'use client'
// 세계 지도 SVG — 등장방형(equirectangular) 투영, world-atlas land-110m, 핫스팟 글로우 + 펄스
import { useMemo, useState } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import land from 'world-atlas/land-110m.json'

export interface HotPoint { key: string; lat: number; lon: number; city: string | null; region: string | null; country: string | null; total: number; kinds: Record<string, number>; last: string; recent: number }

const W = 1000, H = 500  // 경도 -180..180 → 0..1000, 위도 90..-90 → 0..500 (남극 잘라내려면 H 축소)
const project = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]

function ringPath(ring: Position[]) {
  return ring.map((c, i) => { const [x, y] = project(c[0], c[1]); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}` }).join('') + 'Z'
}
function geomPath(g: Geometry): string {
  if (g.type === 'Polygon') return g.coordinates.map(ringPath).join('')
  if (g.type === 'MultiPolygon') return g.coordinates.map(p => p.map(ringPath).join('')).join('')
  return ''
}

const KIND_COLOR: Record<string, string> = { generate: '#2563eb', publish: '#7c3aed', play: '#f59e0b', signup: '#059669', visit: '#94a3b8', game: '#0891b2' }
export const KIND_LABEL: Record<string, string> = { generate: '개발(생성)', publish: '게임 게시', play: '플레이', signup: '가입', visit: '방문', game: '게시 게임(국가 설정)' }
export const flagOf = (code: string | null) => code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐'
const names = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['ko'], { type: 'region' }) : null
export const countryName = (code: string | null) => { if (!code) return '알 수 없음'; try { return names?.of(code) ?? code } catch { return code } }

export default function WorldMap({ points, focus, onHover, cover = false }: { points: HotPoint[]; focus?: string | null; onHover?: (p: HotPoint | null) => void; cover?: boolean }) {
  const [hover, setHover] = useState<HotPoint | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const landPath = useMemo(() => {
    const topo = land as unknown as Topology<{ land: GeometryCollection }>
    const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection
    return fc.features.map(f => geomPath(f.geometry)).join('')
  }, [])
  const max = Math.max(1, ...points.map(p => p.total))
  const r = (t: number) => 3 + Math.sqrt(t / max) * 22
  const dominant = (p: HotPoint) => Object.entries(p.kinds).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'play'
  const set = (p: HotPoint | null) => { setHover(p); onHover?.(p) }

  return (
    <div className={cover ? "absolute inset-0" : "relative w-full"}>
      <svg viewBox={`0 14 ${W} 400`} preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"} className={cover ? "w-full h-full block" : "w-full h-auto block"} role="img" aria-label="개발 활동 지도">
        <defs>
          {Object.entries(KIND_COLOR).map(([k, c]) => <radialGradient key={k} id={`glow-${k}`}><stop offset="0%" stopColor={c} stopOpacity="0.55" /><stop offset="60%" stopColor={c} stopOpacity="0.18" /><stop offset="100%" stopColor={c} stopOpacity="0" /></radialGradient>)}
          <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.6" fill="#241f17" fillOpacity="0.05" /></pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#dots)" />
        {/* 경위선 */}
        {[-120, -60, 0, 60, 120].map(lon => <line key={lon} x1={project(lon, 0)[0]} x2={project(lon, 0)[0]} y1="0" y2={H} stroke="#241f17" strokeOpacity="0.05" />)}
        {[-60, -30, 0, 30, 60].map(lat => <line key={lat} y1={project(0, lat)[1]} y2={project(0, lat)[1]} x1="0" x2={W} stroke="#241f17" strokeOpacity="0.05" />)}
        {/* 육지 */}
        <path d={landPath} fill="#e9e2d3" stroke="#d3c9b4" strokeWidth="0.6" />
        {/* 핫스팟 */}
        {[...points].sort((a, b) => b.total - a.total).map(p => {
          const [x, y] = project(p.lon, p.lat); const rad = r(p.total); const col = KIND_COLOR[dominant(p)]
          const isFocus = focus === p.key || hover?.key === p.key
          return (
            <g key={p.key} style={{ color: col }} onMouseEnter={(e) => { const r = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement).getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); set(p) }} onMouseLeave={() => set(null)} className="cursor-pointer">
              {p.recent > 0 && <circle cx={x} cy={y} r={rad} fill="none" stroke={col} strokeWidth="1.2" className="map-pulse" />}
              <circle cx={x} cy={y} r={rad * 1.6} fill={`url(#glow-${dominant(p)})`} opacity={isFocus ? 1 : 0.8} />
              <circle cx={x} cy={y} r={Math.max(2.2, rad * 0.35)} fill="#fff" stroke={col} strokeWidth="1.5" />
            </g>
          )
        })}
      </svg>
      {hover && (() => { return (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-white border border-[#ebe4d6] px-3 py-2 text-[#241f17] shadow-xl" style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, calc(-100% - 14px))', minWidth: 160 }}>
          <p className="text-[13px] font-bold">{flagOf(hover.country)} {hover.city ?? countryName(hover.country)}{hover.region && hover.city ? <span className="text-[#9d9280] font-normal"> · {hover.region}</span> : null}</p>
          <p className="text-[11px] text-[#857a68]">{countryName(hover.country)} · 총 {hover.total.toLocaleString()}회{hover.recent ? ` · 24h ${hover.recent}` : ''}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">{Object.entries(hover.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className="text-[11px]" style={{ color: KIND_COLOR[k] }}>● {KIND_LABEL[k] ?? k} {v}</span>)}</div>
        </div>
      ) })()}
      <style jsx global>{`
        @keyframes mapPulse { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(2.6); opacity: 0 } }
        .map-pulse { transform-box: fill-box; transform-origin: center; animation: mapPulse 2.4s ease-out infinite; }
      `}</style>
    </div>
  )
}
