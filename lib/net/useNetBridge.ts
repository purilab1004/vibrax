'use client'
// 호스트 페이지(플레이 오버레이·스튜디오 미리보기)에서 게임 iframe 의 온라인 브리지를 여는 훅
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createNetBridge } from './bridge'

export function useNetBridge(active: boolean, getFrame: () => HTMLIFrameElement | null, gameId: string) {
  const getFrameRef = useRef(getFrame)
  useEffect(() => { getFrameRef.current = getFrame })
  useEffect(() => {
    if (!active || !gameId) return
    const supabase = createClient()
    let bridge: ReturnType<typeof createNetBridge> | null = null
    let alive = true
    const ensure = async () => {
      if (bridge) return bridge
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      const u = session?.user
      const name = String(u?.user_metadata?.agent_name || u?.user_metadata?.username || u?.email?.split('@')[0] || `GUEST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`).slice(0, 16)
      if (!alive) return null
      bridge = createNetBridge(supabase, { gameId, name, userId: u?.id ?? null })
      return bridge
    }
    const h = (e: MessageEvent) => {
      const d = e.data as { type?: string } | null
      if (!d || d.type !== 'vibrex:net') return
      const win = getFrameRef.current()?.contentWindow ?? null
      if (win && e.source !== win) return
      void ensure().then(b => b?.handle(e, win))
    }
    window.addEventListener('message', h)
    return () => { alive = false; window.removeEventListener('message', h); bridge?.detach() }
  }, [active, gameId])
}
