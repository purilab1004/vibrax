// 클라이언트에서 오는 지오 핑 — 플레이 시작(play) / 게임 게시(publish). 지오 정보는 요청 헤더에서만 읽는다.
import { createClient } from '@/lib/supabase/server'
import { trackGeo, type GeoKind } from '@/lib/geo/track'

const ALLOWED: GeoKind[] = ['play', 'publish', 'visit']

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { kind?: GeoKind; ref?: string } | null
  if (!b?.kind || !ALLOWED.includes(b.kind)) return new Response('bad request', { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await trackGeo(req.headers, b.kind, user?.id ?? null, b.ref ?? null)
  return new Response(null, { status: 204 })
}
