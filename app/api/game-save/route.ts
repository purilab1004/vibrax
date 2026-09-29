// /api/game-save — 게임 안 저장 데이터(localStorage 스냅샷)를 계정에 보관한다. 게임마다 저장 슬롯은 최대 3칸.
//   GET    ?gameId=...            → { slots: [요약|null ×3], latest, save(가장 최근 슬롯 데이터) }
//   GET    ?gameId=...&slot=2     → 그 슬롯 데이터만 { save }
//   POST   { gameId, slot, data } → 그 슬롯에 저장(덮어쓰기). slot 은 1~3 만 — 4번째 칸은 만들 수 없다
//   DELETE ?gameId=...&slot=2     → 그 슬롯 비우기 (slot=all 이면 전부 초기화)
// 게임 코드를 고치지 않아도 되도록 저장소를 통째로 다루고, 기기가 바뀌어도 이어서 할 수 있다.
import { createClient } from '@/lib/supabase/server'
import { parseSlots, packSlots, summarize, latestSlot, labelOf, isSlotNo, type SlotMap } from '@/lib/game-saves'

const MAX_BYTES = 64 * 1024          // 슬롯 하나당
const GAME_ID = /^[0-9a-f-]{36}$/i

async function loadRow(gameId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, slots: {} as SlotMap }
  const { data } = await supabase.from('game_saves').select('data, updated_at').eq('user_id', user.id).eq('game_id', gameId).maybeSingle()
  const row = data as { data: unknown; updated_at: string } | null
  return { supabase, user, slots: parseSlots(row?.data, row?.updated_at) }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const gameId = q.get('gameId') ?? ''
  if (!GAME_ID.test(gameId)) return Response.json({ error: 'bad gameId' }, { status: 400 })
  const { user, slots } = await loadRow(gameId)
  if (!user) return Response.json({ save: null, slots: [null, null, null], latest: null, guest: true })
  const want = Number(q.get('slot'))
  if (isSlotNo(want)) return Response.json({ save: slots[String(want) as '1']?.data ?? null })
  const latest = latestSlot(slots)
  return Response.json({ slots: summarize(slots), latest, save: latest ? slots[String(latest) as '1']!.data : null })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { gameId?: string; slot?: number; data?: Record<string, string> } | null
  const gameId = body?.gameId ?? ''
  if (!GAME_ID.test(gameId) || !body?.data || typeof body.data !== 'object') return Response.json({ error: 'bad request' }, { status: 400 })
  const slot = body.slot ?? 1
  if (!isSlotNo(slot)) return Response.json({ error: 'slot must be 1-3' }, { status: 400 })
  // 빈 스냅샷은 저장하지 않는다 — 시작 전에 눌린 저장이 기존 진행을 지우지 않게
  if (Object.keys(body.data).length === 0) return Response.json({ error: 'empty save' }, { status: 400 })
  const json = JSON.stringify(body.data)
  if (json.length > MAX_BYTES) return Response.json({ error: 'too large', bytes: json.length }, { status: 413 })
  const { supabase, user, slots } = await loadRow(gameId)
  if (!user) return Response.json({ error: 'login required' }, { status: 401 })
  const now = new Date().toISOString()
  slots[String(slot) as '1'] = { data: body.data, at: now, label: labelOf(body.data) }
  const { error } = await supabase.from('game_saves')
    .upsert({ user_id: user.id, game_id: gameId, data: packSlots(slots), bytes: JSON.stringify(slots).length, updated_at: now } as never, { onConflict: 'user_id,game_id' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, slot, bytes: json.length, slots: summarize(slots) })
}

export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams
  const gameId = q.get('gameId') ?? ''
  if (!GAME_ID.test(gameId)) return Response.json({ error: 'bad gameId' }, { status: 400 })
  const { supabase, user, slots } = await loadRow(gameId)
  if (!user) return Response.json({ error: 'login required' }, { status: 401 })
  const which = q.get('slot')
  const n = Number(which)
  if (which !== 'all' && !isSlotNo(n)) return Response.json({ error: 'slot must be 1-3 or all' }, { status: 400 })
  if (which !== 'all') delete slots[String(n) as '1']
  const empty = which === 'all' || Object.keys(slots).length === 0
  const { error } = empty
    ? await supabase.from('game_saves').delete().eq('user_id', user.id).eq('game_id', gameId)
    : await supabase.from('game_saves').update({ data: packSlots(slots), bytes: JSON.stringify(slots).length } as never).eq('user_id', user.id).eq('game_id', gameId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, slots: empty ? [null, null, null] : summarize(slots) })
}
