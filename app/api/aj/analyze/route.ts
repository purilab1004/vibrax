// app/api/aj/analyze/route.ts — AJ Brain: 게임 운영 지표 + 코드 + 프롬프트를 읽고
// 재미 분석 · 이탈 구간 · 개선 프롬프트(게임 업데이트 제안) · 방송/성장/수익 아이디어를 JSON 리포트로 만든다.
// 실제 생성은 lib/aj/report.ts (자율 디자이너 루프와 공용).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAjReport, type ReportGame } from '@/lib/aj/report'

export const runtime = 'nodejs'
export const maxDuration = 120

export type { AjReport } from '@/lib/aj/report'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { gameId?: string } | null
  const gameId = body?.gameId
  if (!gameId) return Response.json({ error: 'bad request' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: game }, { data: prof }] = await Promise.all([
    admin.from('games').select('id,title,description,genre,user_id,studio_project_id,coin_cost,teaser').eq('id', gameId).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  const g = game as ReportGame | null
  if (!g) return Response.json({ error: 'not found' }, { status: 404 })
  const isAdmin = (prof as { role?: string } | null)?.role === 'admin'
  if (g.user_id !== user.id && !isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 })

  try {
    const out = await buildAjReport(admin, g, user.id)
    return Response.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'report failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
