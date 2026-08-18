// 지도보드 데이터 — geo_events 집계 (도시 클러스터 · 국가 랭킹 · 최근 이벤트 · 종류별 합계)
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 60

interface Ev { kind: string; country: string | null; region: string | null; city: string | null; lat: number | null; lon: number | null; created_at: string }

export async function GET(req: Request) {
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get('days') ?? 7)))
  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 864e5).toISOString()
  // 개발 환경 데모 데이터 (?demo=1) — 레이아웃 확인용
  if (url.searchParams.get('demo') === '1' && process.env.NODE_ENV !== 'production') {
    const demo: Ev[] = []
    const cities: [string, string, string, number, number, number][] = [['KR','서울','Seoul',37.57,126.98,120],['KR','부산','Busan',35.18,129.08,30],['US','California','San Francisco',37.77,-122.42,45],['US','New York','New York',40.71,-74.01,25],['JP','Tokyo','Tokyo',35.68,139.69,40],['DE','Berlin','Berlin',52.52,13.4,12],['BR','São Paulo','São Paulo',-23.55,-46.63,18],['IN','Karnataka','Bengaluru',12.97,77.59,22],['GB','England','London',51.51,-0.13,16],['AU','NSW','Sydney',-33.87,151.21,9],['SG','','Singapore',1.35,103.82,14],['FR','Île-de-France','Paris',48.86,2.35,8],['NG','Lagos','Lagos',6.52,3.38,6],['MX','CDMX','Mexico City',19.43,-99.13,7]]
    const ks = ['generate','generate','play','play','play','publish','signup']
    for (const [country, region, city, lat, lon, n] of cities) for (let i = 0; i < n; i++) demo.push({ kind: ks[(i * 7 + city.length) % ks.length], country, region, city, lat: lat + (Math.random() - .5) * .2, lon: lon + (Math.random() - .5) * .2, created_at: new Date(Date.now() - Math.random() * days * 864e5).toISOString() })
    demo.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return Response.json(aggregate(demo, days))
  }
  const { data, error } = await admin.from('geo_events').select('kind,country,region,city,lat,lon,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(50000)
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  return Response.json(aggregate((data ?? []) as Ev[], days))
}

function aggregate(rows: Ev[], days: number) {
  const dayAgo = Date.now() - 864e5

  const points = new Map<string, { key: string; lat: number; lon: number; city: string | null; region: string | null; country: string | null; total: number; kinds: Record<string, number>; last: string; recent: number }>()
  const countries = new Map<string, { code: string; total: number; kinds: Record<string, number>; cities: Set<string> }>()
  const kinds: Record<string, number> = {}
  for (const r of rows) {
    kinds[r.kind] = (kinds[r.kind] ?? 0) + 1
    if (r.country) {
      const c = countries.get(r.country) ?? { code: r.country, total: 0, kinds: {}, cities: new Set<string>() }
      c.total++; c.kinds[r.kind] = (c.kinds[r.kind] ?? 0) + 1; if (r.city) c.cities.add(r.city); countries.set(r.country, c)
    }
    if (r.lat == null || r.lon == null) continue
    const key = r.city ? `${r.country}:${r.city}` : `${Math.round(r.lat * 2) / 2},${Math.round(r.lon * 2) / 2}`
    const p = points.get(key) ?? { key, lat: r.lat, lon: r.lon, city: r.city, region: r.region, country: r.country, total: 0, kinds: {}, last: r.created_at, recent: 0 }
    p.total++; p.kinds[r.kind] = (p.kinds[r.kind] ?? 0) + 1
    if (new Date(r.created_at).getTime() > dayAgo) p.recent++
    if (r.created_at > p.last) p.last = r.created_at
    points.set(key, p)
  }
  return {
    days, total: rows.length, kinds,
    points: [...points.values()].sort((a, b) => b.total - a.total),
    countries: [...countries.values()].map(c => ({ ...c, cities: c.cities.size })).sort((a, b) => b.total - a.total),
    recent: rows.slice(0, 40).map(r => ({ kind: r.kind, city: r.city, country: r.country, at: r.created_at })),
  }
}
