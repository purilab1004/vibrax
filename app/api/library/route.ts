// 공개 라이브러리 — 승인된(active) 에셋 목록·검색. 로그인 없이 볼 수 있다.
// 모두에게 preview(워터마크 미리보기 /api/library/preview/<id>)를 주고, 원본 url 은 로그인 회원에게만 준다(복제·무단 수집 방지).
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { INJECTABLE } from '@/lib/media/assets'

export async function GET(req: Request) {
  const u = new URL(req.url)
  const q = (u.searchParams.get('q') ?? '').trim().toLowerCase().replace(/[{}",]/g, '')
  const kind = u.searchParams.get('kind') ?? ''
  const limit = Math.min(200, Math.max(1, Number(u.searchParams.get('limit') ?? 120)))
  try {
    const admin = createAdminClient()
    // 3D 모델은 갤러리 '전체' 목록에 안 보인다 (디자이너 드라이브 · 미디어 선택기에서 쓴다)
    const build = (withDesigner: boolean, withVis = withDesigner) => {
      const sel: string = `id,kind,name,title,description,genres,tags,url,width,height,bytes,uses,created_at,meta${withDesigner ? ',designer_id' : ''}`
      let query = admin.from('media_assets').select(sel).eq('status', 'active').in('kind', kind ? [...INJECTABLE] : [...INJECTABLE].filter((k) => k !== 'model3d')).order('created_at', { ascending: false }).limit(limit)
      if (withVis) query = query.eq('visibility', 'public') // 관리자 전용 에셋은 갤러리에 안 보인다
      if (kind) query = query.eq('kind', kind)
      if (q) query = query.or(`title.ilike.%${q}%,name.ilike.%${q}%,tags.cs.{${q}}`)
      return query
    }
    // designer_id 컬럼(마이그레이션)이 아직 없으면 없이 다시 조회
    let res = await build(true)
    if (res.error && /visibility/.test(res.error.message)) res = await build(true, false)
    if (res.error && /designer_id/.test(res.error.message)) res = await build(false, false)
    const error = res.error; const data = (res.data ?? []) as unknown as { designer_id?: string | null }[]
    if (error) return Response.json({ items: [], error: error.message })
    // 디자이너 이름
    const { data: { user } } = await (await createClient()).auth.getUser()
    const ids = [...new Set((data ?? []).map((a) => (a as { designer_id: string | null }).designer_id).filter((x): x is string => !!x))]
    const names: Record<string, string> = {}
    if (ids.length) { const { data: profs } = await admin.from('profiles').select('id,username,agent_name').in('id', ids); for (const p of (profs ?? []) as { id: string; username: string | null; agent_name: string | null }[]) names[p.id] = p.agent_name ?? p.username ?? '디자이너' }
    const items = (data ?? []).map((a) => {
      const { url, ...rest } = a as unknown as { url: string; id: string; kind: string; designer_id: string | null }
      const preview = rest.kind === 'audio' ? null : `/api/library/preview/${rest.id}`
      return { ...rest, ...(user ? { url } : {}), preview, designer_name: names[rest.designer_id ?? ''] ?? null }
    })
    return Response.json({ items, loggedIn: !!user }, { headers: { 'Cache-Control': 'private, max-age=15' } })
  } catch (e) { return Response.json({ items: [], error: e instanceof Error ? e.message : 'error' }) }
}
