// 게임 제작자용 AJ 학습 가이드 — 제작자가 자기 게임의 "정석 지식"(기본기 단계)을 등록하면
// 다른 사람들의 AI 아바타가 그 게임을 플레이할 때 시간차를 두고 단계별로 학습해 나간다.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateCurriculum } from '@/lib/studio/bot-curriculum'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'

async function ownerOf(gameId: string) {
  const { data } = await createAdminClient().from('games').select('user_id,title').eq('id', gameId).maybeSingle()
  return data as { user_id: string; title: string } | null
}
export async function GET(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const gameId = new URL(req.url).searchParams.get('gameId')
  if (!gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data } = await createAdminClient().from('aj_bot_curriculum').select('id,step_order,name,hint,enabled').eq('game_id', gameId).order('step_order')
  return Response.json({ rows: data ?? [] })
}
export async function POST(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!rateLimit(`gcur:${user.id}`, 60, 3600_000).ok) return tooMany()
  const b = await req.json().catch(() => null) as { gameId?: string; name?: string; hint?: string } | null
  if (!b?.gameId || !b.name?.trim() || !b.hint?.trim()) return Response.json({ error: '단계 이름과 가르칠 내용을 입력하세요.' }, { status: 400 })
  const g = await ownerOf(b.gameId)
  if (!g || g.user_id !== user.id) return Response.json({ error: 'forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { count } = await admin.from('aj_bot_curriculum').select('id', { count: 'exact', head: true }).eq('game_id', b.gameId)
  if ((count ?? 0) >= 20) return Response.json({ error: '단계는 20개까지 등록할 수 있어요.' }, { status: 400 })
  const { error } = await admin.from('aj_bot_curriculum').insert([{ template_key: `game:${b.gameId}`, game_id: b.gameId, step_order: ((count ?? 0) + 1) * 10, name: b.name.trim().slice(0, 60), hint: b.hint.trim().slice(0, 500), created_by: user.id }] as never)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  invalidateCurriculum()
  return Response.json({ ok: true })
}
export async function DELETE(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('aj_bot_curriculum').select('game_id,created_by').eq('id', b.id).maybeSingle()
  const row = data as { game_id: string | null; created_by: string | null } | null
  if (!row) return Response.json({ error: 'not found' }, { status: 404 })
  if (row.created_by !== user.id) { const g = row.game_id ? await ownerOf(row.game_id) : null; if (!g || g.user_id !== user.id) return Response.json({ error: 'forbidden' }, { status: 403 }) }
  await admin.from('aj_bot_curriculum').delete().eq('id', b.id)
  invalidateCurriculum()
  return Response.json({ ok: true })
}
