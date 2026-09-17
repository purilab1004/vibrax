// 미디어 라이브러리 조회 (로그인 사용자) — 스튜디오 미디어 선택기용. 공개 에셋 메타만.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INJECTABLE } from '@/lib/media/assets'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const u = new URL(req.url)
  const q = (u.searchParams.get('q') ?? '').trim().toLowerCase().replace(/[{}",]/g, '')
  const kind = u.searchParams.get('kind') ?? ''
  const genre = u.searchParams.get('genre') ?? ''
  const limit = Math.min(120, Math.max(1, Number(u.searchParams.get('limit') ?? 60)))
  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = (prof as { role?: string } | null)?.role === 'admin'
  const run = async (withVis: boolean) => {
    let q2 = admin.from('media_assets').select('id,kind,name,title,description,genres,tags,url,mime,bytes,width,height,meta,uses,credit_cost').eq('status', 'active').in('kind', [...INJECTABLE]).order('uses', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
    if (withVis) q2 = q2.eq('visibility', 'public')
    if (kind) q2 = q2.eq('kind', kind)
    if (genre) q2 = q2.contains('genres', [genre])
    if (q) q2 = q2.or(`title.ilike.%${q}%,name.ilike.%${q}%,tags.cs.{${q}}`)
    return q2
  }
  // 관리자 전용 에셋은 관리자에게만 보인다 (컬럼이 없으면 필터 없이)
  let res = await run(!isAdmin)
  if (res.error && /visibility/.test(res.error.message)) res = await run(false)
  if (res.error) return Response.json({ items: [], error: res.error.message })
  return Response.json({ items: res.data ?? [] })
}
