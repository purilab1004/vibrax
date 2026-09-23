// 쇼츠 배경음 — 미디어 라이브러리 오디오 에셋 이름 → 공개 URL (관리자가 같은 이름으로 파일을 바꾸면 그대로 반영)
import { createAdminClient } from '@/lib/supabase/admin'
import { FEED_BGM_NAMES } from '@/lib/feedBgmConfig'

export async function GET() {
  try {
    const { data } = await createAdminClient().from('media_assets').select('name,url').eq('kind', 'audio').eq('status', 'active').in('name', FEED_BGM_NAMES)
    const urls: Record<string, string> = {}
    for (const a of (data ?? []) as { name: string; url: string }[]) urls[a.name] = a.url
    return Response.json({ urls }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
  } catch { return Response.json({ urls: {} }) }
}
