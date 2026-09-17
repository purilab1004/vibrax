// 게시 썸네일 기본 배경 — 미디어 라이브러리의 'default_background' 에셋 URL (공개). 클라이언트 썸네일 생성기(lib/thumbnail.ts)가 쓴다.
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300

export async function GET(req: Request) {
  try {
    const portrait = new URL(req.url).searchParams.get('portrait') === '1'
    const admin = createAdminClient()
    type Row = { url: string; width: number | null; height: number | null }
    let a: Row | null = null
    // 세로(쇼츠) 썸네일용 — 'default_background_portrait' 에셋이 등록돼 있으면 그것을, 없으면 가로 기본 배경을 cover 로 자른다
    if (portrait) { const { data } = await admin.from('media_assets').select('url,width,height').eq('name', 'default_background_portrait').eq('status', 'active').limit(1).maybeSingle(); a = (data as Row | null) ?? null }
    if (!a) { const { data } = await admin.from('media_assets').select('url,width,height').eq('name', 'default_background').eq('status', 'active').limit(1).maybeSingle(); a = (data as Row | null) ?? null }
    return Response.json(a ? { url: a.url, width: a.width, height: a.height } : { url: null }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' } })
  } catch { return Response.json({ url: null }) }
}
