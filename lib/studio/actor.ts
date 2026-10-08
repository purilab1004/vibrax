// 스튜디오 생성의 "누가" — 웹(로그인 쿠키) 또는 데스크톱 빌더(개발자 API 키 Bearer vxaj_…)
// 키로 들어오면 서비스 롤 클라이언트로 동작하므로 RLS 대신 user_id 를 직접 확인해야 한다 (ownsProject)
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateApi, API_KEY_PREFIX } from '@/lib/aj/api-auth'

export interface StudioActor {
  db: SupabaseClient
  userId: string
  viaKey: boolean
  /** 크레딧 원자적 차감. 잔액 부족이면 Error('INSUFFICIENT_CREDITS…') */
  spend(amount: number, ref: string): Promise<{ error: { message: string } | null }>
}

export const isKeyRequest = (req: Request) => (req.headers.get('authorization') ?? '').startsWith('Bearer ' + API_KEY_PREFIX)

export async function resolveStudioActor(req: Request): Promise<StudioActor | Response> {
  if (isKeyRequest(req)) {
    const id = await authenticateApi(req, 'build')
    if (id instanceof Response) return id
    const db = createAdminClient() as unknown as SupabaseClient
    return {
      db, userId: id.userId, viaKey: true,
      async spend(amount, ref) {
        const { error } = await db.rpc('spend_credits_for', { p_user_id: id.userId, p_amount: amount, p_ref: ref, p_reason: 'generation' } as never)
        return { error: error ? { message: error.message } : null }
      },
    }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  return {
    db: supabase as unknown as SupabaseClient, userId: user.id, viaKey: false,
    async spend(amount, ref) {
      const { error } = await supabase.rpc('spend_credits', { p_amount: amount, p_ref: ref } as never)
      return { error: error ? { message: error.message } : null }
    },
  }
}
