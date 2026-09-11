import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLeaderboard } from '@/lib/games/leaderboard'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lb = await loadLeaderboard(createAdminClient(), id, user?.id ?? null)
  return Response.json(lb, { headers: { 'Cache-Control': 'no-store' } })
}
