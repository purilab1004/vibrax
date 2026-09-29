// /api/game-save — 게임 안 저장 데이터(localStorage 스냅샷)를 계정에 보관한다.
//   GET  ?gameId=...        → 저장본 내려주기 (없으면 null)
//   POST { gameId, data }   → 저장(덮어쓰기). 64KB 제한.
// 게임 코드를 고치지 않아도 되도록 저장소를 통째로 다루고, 기기가 바뀌어도 이어서 할 수 있다.
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 64 * 1024

export async function GET(req: Request) {
  const gameId = new URL(req.url).searchParams.get('gameId') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return Response.json({ error: 'bad gameId' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ save: null, guest: true })
  const { data } = await supabase.from('game_saves').select('data, updated_at').eq('user_id', user.id).eq('game_id', gameId).maybeSingle()
  const row = data as { data: Record<string, string>; updated_at: string } | null
  return Response.json({ save: row?.data ?? null, updatedAt: row?.updated_at ?? null })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { gameId?: string; data?: Record<string, string> } | null
  const gameId = body?.gameId ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(gameId) || !body?.data || typeof body.data !== 'object') return Response.json({ error: 'bad request' }, { status: 400 })
  // 빈 스냅샷은 저장하지 않는다 — 시작 전에 눌린 저장이 기존 진행을 지우지 않게
  if (Object.keys(body.data).length === 0) return Response.json({ error: 'empty save' }, { status: 400 })
  const json = JSON.stringify(body.data)
  if (json.length > MAX_BYTES) return Response.json({ error: 'too large', bytes: json.length }, { status: 413 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'login required' }, { status: 401 })
  const { error } = await supabase.from('game_saves')
    .upsert({ user_id: user.id, game_id: gameId, data: body.data, bytes: json.length, updated_at: new Date().toISOString() } as never, { onConflict: 'user_id,game_id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, bytes: json.length })
}
