'use client'
// 관리자 여부(클라이언트) — UI 노출 판단용. 서버는 요청마다 다시 확인하므로 이 값만으로 권한이 열리지 않는다.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

let cached: boolean | null = null

export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(cached)
  useEffect(() => {
    if (cached !== null) return
    let alive = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { cached = false; if (alive) setIsAdmin(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      cached = (data as { role?: string } | null)?.role === 'admin'
      if (alive) setIsAdmin(cached)
    }).catch(() => { if (alive) setIsAdmin(false) })
    return () => { alive = false }
  }, [])
  return isAdmin
}
