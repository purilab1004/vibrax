// 영상 링크의 제목 — YouTube oEmbed(키 불필요)로 받아 방송/영상 등록 시 제목을 자동 채운다
export const revalidate = 3600
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') ?? ''
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url)) return Response.json({ title: null })
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { next: { revalidate: 3600 } })
    if (!r.ok) return Response.json({ title: null })
    const j = await r.json() as { title?: string; author_name?: string }
    return Response.json({ title: j.title ?? null, author: j.author_name ?? null }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  } catch { return Response.json({ title: null }) }
}
