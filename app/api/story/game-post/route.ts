import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAutomation, logAutomation } from '@/lib/automation'
import { startSeries, apiLlm } from '@/lib/story/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// 게임 첫 게시 → STORY 연재 시작(1화). 게임당 1회(멱등), fire-and-forget 호출용.
export async function POST(req: Request) {
  try {
    const { gameId } = await req.json()
    if (!gameId || typeof gameId !== 'string') return NextResponse.json({ error: 'gameId required' }, { status: 400 })
    const published = (await loadAutomation())['blog.autoPost']
    const ep = await startSeries(createAdminClient(), apiLlm, gameId, { published })
    if (!ep) return NextResponse.json({ ok: true, skipped: 'exists' })
    void logAutomation({ module: 'blog', action: published ? 'STORY 1화 자동 발행' : 'STORY 1화 초안 저장(사람 검토)', target: gameId, status: published ? 'ok' : 'needs_review', detail: { title: ep.title } })
    return NextResponse.json({ ok: true, episode: ep })
  } catch (e) {
    void logAutomation({ module: 'blog', action: 'STORY 1화 생성 실패', status: 'error', detail: { error: (e as Error).message } })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
