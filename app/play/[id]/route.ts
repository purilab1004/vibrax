import { createAdminClient } from '@/lib/supabase/admin'
import { hardenHtml } from '@/lib/studio/harden'

// 게시된 스튜디오 게임의 최신 버전 HTML을 서빙한다.
// studio_versions는 RLS로 소유자만 읽을 수 있으므로 admin 클라이언트를 쓰되,
// games에 게시 레코드가 있는 프로젝트만 공개한다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: game } = await admin
    .from('games').select('id').eq('studio_project_id', id).limit(1).maybeSingle()
  if (!game) return new Response('Not Found', { status: 404 })

  const { data: version } = await admin
    .from('studio_versions').select('html')
    .eq('project_id', id).order('version', { ascending: false })
    .limit(1).maybeSingle()
  if (!version) return new Response('Not Found', { status: 404 })

  return new Response(hardenHtml((version as { html: string }).html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 최상위 문서로 열려도 스크립트 격리 유지
      'Content-Security-Policy':
        "sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:;",
      'Cache-Control': 'no-store',
    },
  })
}
