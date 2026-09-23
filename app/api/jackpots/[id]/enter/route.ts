// 잭팟 참여 — 로그인 회원이 참가비(코인)를 내고 1장 참여. DB 함수가 원자적으로 차감·기록한다
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase.rpc('enter_jackpot', { p_jackpot_id: id } as never)
  if (error) {
    const m = error.message
    const msg = /insufficient_vcoin|INSUFFICIENT_CREDITS/.test(m) ? '토큰동전이 부족해요' : m.includes('jackpot_closed') ? '마감된 잭팟이에요' : m.includes('jackpot_not_found') ? '잭팟을 찾을 수 없어요' : m
    return Response.json({ error: msg }, { status: 400 })
  }
  return Response.json({ ok: true, balance: data })
}
