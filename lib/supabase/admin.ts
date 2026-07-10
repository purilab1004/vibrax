// 서버 전용(service role). 웹훅 크레딧 지급과 /play 공개 서빙에만 사용한다.
// 클라이언트 번들에 포함되면 안 됨 — 'use client' 파일에서 import 금지.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
