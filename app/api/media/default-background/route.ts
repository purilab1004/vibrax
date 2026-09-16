// 게시 썸네일 기본 배경 — 미디어 라이브러리의 'default_background' 에셋 URL (공개). 클라이언트 썸네일 생성기(lib/thumbnail.ts)가 쓴다.
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300

export async function GET() {
  try {
    const { data } = await createAdminClient().from('media_assets').select('url,width,height').eq('name', 'default_background').eq('status', 'active').limit(1).maybeSingle()
    const a = data as { url: string; width: number | null; height: number | null } | null
    return Response.json(a ? { url: a.url, width: a.width, height: a.height } : { url: null }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' } })
  } catch { return Response.json({ url: null }) }
}
