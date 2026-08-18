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

const KIND_COLOR: Record<string, string> = { generate: '#22d3ee', publish: '#a78bfa', play: '#fbbf24', signup: '#34d399', visit: '#94a3b8' }
export const KIND_LABEL: Record<string, string> = { generate: '개발(생성)', publish: '게임 게시', play: '플레이', signup: '가입', visit: '방문' }
export const flagOf = (code: string | null) => code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐'
const names = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['ko'], { type: 'region' }) : null
export const countryName = (code: string | null) => { if (!code) return '알 수 없음'; try { return names?.of(code) ?? code } catch { return code } }

export default function WorldMap({ points, focus, onHover }: { points: HotPoint[]; focus?: string | null; onHover?: (p: HotPoint | null) => void }) {
  const [hover, setHover] = useState<HotPoint | null>(null)
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
    <div className="relative w-full">
      <svg viewBox={`0 14 ${W} 400`} className="w-full h-auto block" role="img" aria-label="개발 활동 지도">
        <defs>
          <radialGradient id="glow"><stop offset="0%" stopColor="#fff" stopOpacity="0.9" /><stop offset="35%" stopColor="currentColor" stopOpacity="0.85" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></radialGradient>
          <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.6" fill="#ffffff" fillOpacity="0.06" /></pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#dots)" />
        {/* 경위선 */}
        {[-120, -60, 0, 60, 120].map(lon => <line key={lon} x1={project(lon, 0)[0]} x2={project(lon, 0)[0]} y1="0" y2={H} stroke="#fff" strokeOpacity="0.04" />)}
        {[-60, -30, 0, 30, 60].map(lat => <line key={lat} y1={project(0, lat)[1]} y2={project(0, lat)[1]} x1="0" x2={W} stroke="#fff" strokeOpacity="0.04" />)}
        {/* 육지 */}
        <path d={landPath} fill="#1a2440" stroke="#2f3d63" strokeWidth="0.6" />
        {/* 핫스팟 */}
        {[...points].sort((a, b) => b.total - a.total).map(p => {
          const [x, y] = project(p.lon, p.lat); const rad = r(p.total); const col = KIND_COLOR[dominant(p)]
          const isFocus = focus === p.key || hover?.key === p.key
          return (
            <g key={p.key} style={{ color: col }} onMouseEnter={() => set(p)} onMouseLeave={() => set(null)} className="cursor-pointer">
              {p.recent > 0 && <circle cx={x} cy={y} r={rad} fill="none" stroke={col} strokeWidth="1.2" className="map-pulse" />}
              <circle cx={x} cy={y} r={rad * 1.9} fill="url(#glow)" opacity={isFocus ? 0.9 : 0.55} />
              <circle cx={x} cy={y} r={Math.max(2.2, rad * 0.35)} fill="#fff" stroke={col} strokeWidth="1.5" />
            </g>
          )
        })}
      </svg>
      {hover && (() => { const [x, y] = project(hover.lon, hover.lat); return (
        <div className="pointer-events-none absolute z-10 rounded-xl bg-[#0b1020]/95 border border-white/10 px-3 py-2 text-white shadow-2xl backdrop-blur" style={{ left: `${(x / W) * 100}%`, top: `${((y - 14) / 400) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))', minWidth: 160 }}>
          <p className="text-[13px] font-bold">{flagOf(hover.country)} {hover.city ?? countryName(hover.country)}{hover.region && hover.city ? <span className="text-white/50 font-normal"> · {hover.region}</span> : null}</p>
          <p className="text-[11px] text-white/60">{countryName(hover.country)} · 총 {hover.total.toLocaleString()}회{hover.recent ? ` · 24h ${hover.recent}` : ''}</p>
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
