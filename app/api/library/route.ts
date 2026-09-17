// 공개 라이브러리 — 승인된(active) 에셋 목록·검색. 로그인 없이 볼 수 있다 (URL 은 공개 스토리지)
import { createAdminClient } from '@/lib/supabase/admin'
import { INJECTABLE } from '@/lib/media/assets'

export const revalidate = 60
export async function GET(req: Request) {
  const u = new URL(req.url)
  const q = (u.searchParams.get('q') ?? '').trim().toLowerCase().replace(/[{}",]/g, '')
  const kind = u.searchParams.get('kind') ?? ''
  const limit = Math.min(200, Math.max(1, Number(u.searchParams.get('limit') ?? 120)))
  try {
    const admin = createAdminClient()
    const build = (withDesigner: boolean) => {
      const sel: string = `id,kind,name,title,description,genres,tags,url,width,height,bytes,uses,created_at${withDesigner ? ',designer_id' : ''}`
      let query = admin.from('media_assets').select(sel).eq('status', 'active').in('kind', [...INJECTABLE]).order('created_at', { ascending: false }).limit(limit)
      if (kind) query = query.eq('kind', kind)
      if (q) query = query.or(`title.ilike.%${q}%,name.ilike.%${q}%,tags.cs.{${q}}`)
      return query
    }
    // designer_id 컬럼(마이그레이션)이 아직 없으면 없이 다시 조회
    let res = await build(true)
    if (res.error && /designer_id/.test(res.error.message)) res = await build(false)
    const error = res.error; const data = (res.data ?? []) as unknown as { designer_id?: string | null }[]
    if (error) return Response.json({ items: [], error: error.message })
    // 디자이너 이름
    const ids = [...new Set((data ?? []).map((a) => (a as { designer_id: string | null }).designer_id).filter((x): x is string => !!x))]
    const names: Record<string, string> = {}
    if (ids.length) { const { data: profs } = await admin.from('profiles').select('id,username,agent_name').in('id', ids); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null }[]) names[p.id] = p.agent_name ?? p.username ?? '디자이너' }
    return Response.json({ items: (data ?? []).map((a) => ({ ...(a as object), designer_name: names[(a as { designer_id: string | null }).designer_id ?? ''] ?? null })) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch (e) { return Response.json({ items: [], error: e instanceof Error ? e.message : 'error' }) }
}
