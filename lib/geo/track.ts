// 지오 이벤트 기록 (서버 전용) — Vercel 이 붙여주는 x-vercel-ip-* 헤더만 사용, IP 는 저장하지 않는다.
import { createAdminClient } from '@/lib/supabase/admin'

export type GeoKind = 'generate' | 'publish' | 'play' | 'signup' | 'visit'

export function geoFromHeaders(h: Headers) {
  const dec = (v: string | null) => { if (!v) return null; try { return decodeURIComponent(v) } catch { return v } }
  const lat = Number(h.get('x-vercel-ip-latitude')); const lon = Number(h.get('x-vercel-ip-longitude'))
  return {
    country: h.get('x-vercel-ip-country'), region: dec(h.get('x-vercel-ip-country-region')), city: dec(h.get('x-vercel-ip-city')),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null, lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
  }
}

// 실패해도 요청 흐름을 막지 않는다 (fire-and-forget)
export async function trackGeo(h: Headers, kind: GeoKind, userId: string | null, refId?: string | null) {
  try {
    const g = geoFromHeaders(h)
    if (!g.country && g.lat == null) return
    await createAdminClient().from('geo_events').insert([{ kind, user_id: userId, ref_id: refId ?? null, ...g }] as never)
  } catch (e) { console.warn('[geo] track failed', e) }
}
