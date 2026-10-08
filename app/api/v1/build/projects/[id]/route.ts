// GET /api/v1/build/projects/:id — 데스크톱 게임 빌더: 프로젝트·버전 목록·대화·버전 HTML(?version=N, 없으면 최신)
import { authenticateApi, apiJson, apiError, preflight } from '@/lib/aj/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripAttach } from '@/lib/studio/attach'

export const runtime = 'nodejs'
export const OPTIONS = () => preflight()

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return apiError(400, 'bad id')
  const id = await authenticateApi(req, 'build', { count: false })
  if (id instanceof Response) return id
  const admin = createAdminClient()
  const { data: project } = await admin.from('studio_projects').select('id, title, created_at').eq('id', projectId).eq('user_id', id.userId).maybeSingle()
  if (!project) return apiError(404, 'not found')
  const want = Number(new URL(req.url).searchParams.get('version'))
  const [{ data: versions }, { data: messages }] = await Promise.all([
    admin.from('studio_versions').select('id, version, created_at').eq('project_id', projectId).order('version', { ascending: true }),
    admin.from('studio_messages').select('role, content, created_at').eq('project_id', projectId).order('created_at', { ascending: true }).limit(200),
  ])
  const vs = (versions ?? []) as { id: string; version: number; created_at: string }[]
  const pick = Number.isInteger(want) && want > 0 ? vs.find(v => v.version === want) : vs[vs.length - 1]
  let html: string | null = null
  if (pick) {
    const { data: v } = await admin.from('studio_versions').select('html').eq('id', pick.id).maybeSingle()
    html = (v as { html?: string } | null)?.html ?? null
  }
  return apiJson({
    project, versions: vs,
    current: pick ? { version: pick.version, id: pick.id, html } : null,
    messages: ((messages ?? []) as { role: string; content: string; created_at: string }[]).map(m => ({ ...m, content: stripAttach(m.content ?? '') })),
    studioUrl: `https://vibrexcup.com/studio/${projectId}`,
  })
}
