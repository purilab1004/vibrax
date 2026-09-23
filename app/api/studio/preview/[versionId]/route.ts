import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 스튜디오 미리보기용 버전 HTML — 네이티브 앱 웹뷰는 srcdoc(about:srcdoc) iframe 을 막아 검정 화면만 보이므로
// 같은 출처 URL 로 버전 HTML 을 내려준다. RLS 로 프로젝트 소유자(또는 관리자)만 읽을 수 있다.
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return new NextResponse('bad id', { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.from('studio_versions').select('html').eq('id', versionId).maybeSingle()
  const html = (data as { html?: string } | null)?.html
  if (error || !html) return new NextResponse('not found', { status: 404 })
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  })
}
