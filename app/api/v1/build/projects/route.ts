// /api/v1/build/projects — 데스크톱 게임 빌더: 내 스튜디오 프로젝트 목록(GET) · 새 프로젝트(POST {title})
// 웹 스튜디오와 같은 studio_projects 를 쓰므로 빌더에서 만든 게임은 vibrexcup.com/studio/<id> 에서 이어서 수정·게시할 수 있다
import { authenticateApi, apiJson, apiError, preflight } from '@/lib/aj/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const OPTIONS = () => preflight()

export async function GET(req: Request) {
  const id = await authenticateApi(req, 'build', { count: false })
  if (id instanceof Response) return id
  const admin = createAdminClient()
  const { data, error } = await admin.from('studio_projects').select('id, title, created_at').eq('user_id', id.userId).order('created_at', { ascending: false }).limit(100)
  if (error) return apiError(500, 'list failed')
  return apiJson({ projects: data ?? [] })
}

export async function POST(req: Request) {
  const id = await authenticateApi(req, 'build', { count: false })
  if (id instanceof Response) return id
  const body = await req.json().catch(() => ({})) as { title?: unknown }
  const title = (typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '새 게임').slice(0, 60)
  const admin = createAdminClient()
  const { data, error } = await admin.from('studio_projects').insert([{ user_id: id.userId, title }] as never).select('id, title, created_at').maybeSingle()
  if (error || !data) return apiError(500, 'create failed')
  return apiJson({ project: data })
}
