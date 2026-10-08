// GET /api/v1/build/me — 데스크톱 게임 빌더 로그인 확인: 회원 이름·프롬코인 잔액·생성 1회 비용
import { authenticateApi, apiJson, preflight } from '@/lib/aj/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { GENERATION_COST } from '@/lib/studio/constants'

export const runtime = 'nodejs'
export const OPTIONS = () => preflight()

export async function GET(req: Request) {
  const id = await authenticateApi(req, 'build', { count: false })
  if (id instanceof Response) return id
  const admin = createAdminClient()
  const [{ data: led }, { data: costRow }] = await Promise.all([
    admin.from('credit_ledger').select('amount').eq('user_id', id.userId).limit(5000),
    admin.from('site_settings').select('value').eq('key', 'generation_cost').maybeSingle(),
  ])
  const balance = ((led ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0)
  const c = Number((costRow as { value?: unknown } | null)?.value)
  return apiJson({ username: id.username, balance, generationCost: Number.isFinite(c) && c >= 1 ? c : GENERATION_COST })
}
