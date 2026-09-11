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
  let query = admin.from('media_assets').select('id,kind,name,title,description,genres,tags,url,mime,bytes,width,height,meta,uses').eq('status', 'active').in('kind', [...INJECTABLE]).order('uses', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  if (kind) query = query.eq('kind', kind)
  if (genre) query = query.contains('genres', [genre])
  if (q) query = query.or(`title.ilike.%${q}%,name.ilike.%${q}%,tags.cs.{${q}}`)
  const { data, error } = await query
  if (error) return Response.json({ items: [], error: error.message })
  return Response.json({ items: data ?? [] })
}
