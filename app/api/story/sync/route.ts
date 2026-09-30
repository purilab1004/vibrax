import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAutomation, logAutomation } from '@/lib/automation'
import { syncSeries, apiLlm } from '@/lib/story/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// 게시 버전 변경(업데이트) → 새 지도·몬스터가 생겼으면 STORY 다음 화. 게임 소유자 또는 관리자만.
// 서빙 버전이 그대로면 LLM 을 부르지 않고 바로 끝난다.
export async function POST(req: Request) {
  try {
    const { gameId } = await req.json()
    if (!gameId || typeof gameId !== 'string') return NextResponse.json({ error: 'gameId required' }, { status: 400 })
    const supa = await createClient()
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const admin = createAdminClient()
    const [{ data: g }, { data: p }] = await Promise.all([
      admin.from('games').select('user_id').eq('id', gameId).maybeSingle(),
      admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    ])
    const owner = (g as { user_id?: string } | null)?.user_id === user.id
    if (!owner && (p as { role?: string } | null)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const published = (await loadAutomation())['blog.autoPost']
    const r = await syncSeries(admin, apiLlm, gameId, { published })
    if (r.action === 'added' || r.action === 'started') void logAutomation({ module: 'blog', action: r.action === 'added' ? 'STORY 새 회차(업데이트)' : 'STORY 1화', target: gameId, status: published ? 'ok' : 'needs_review', detail: { ...r } })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
