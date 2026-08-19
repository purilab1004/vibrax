// 접속 로그 — 페이지 뷰 (경로·리퍼러·기기·브라우저·국가). IP 미저장.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geoFromHeaders } from '@/lib/geo/track'
import { ipHash, requestIp } from '@/lib/security/log'

function parseUa(ua: string) {
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Other'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other'
  return { device, browser, os }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { path?: string; referrer?: string; sid?: string } | null
  if (!b?.path) return new Response(null, { status: 204 })
  if (b.path.startsWith('/_next') || b.path.startsWith('/api')) return new Response(null, { status: 204 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ua = req.headers.get('user-agent') ?? ''
  const g = geoFromHeaders(req.headers)
  await createAdminClient().from('visits').insert([{ session_id: b.sid?.slice(0, 64) ?? null, user_id: user?.id ?? null, path: b.path.slice(0, 500), referrer: b.referrer?.slice(0, 500) || null, country: g.country, city: g.city, ip_hash: ipHash(requestIp(req.headers)), ...parseUa(ua) }] as never)
  return new Response(null, { status: 204 })
}
