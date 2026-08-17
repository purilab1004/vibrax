// lib/shares.ts — 공유한 게임 기록 (game_shares). 테이블이 아직 없으면 조용히 무시.
import { createClient } from '@/lib/supabase/client'

export async function recordShare(gameId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('game_shares').upsert({ game_id: gameId, user_id: user.id } as never, { onConflict: 'game_id,user_id', ignoreDuplicates: true })
  } catch { /* ignore */ }
}
