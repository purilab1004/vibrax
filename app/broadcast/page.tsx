'use client'
// /broadcast — 폰 카메라로 내 게임 BJ 방송하기 (WebRTC P2P). 화면을 켜 둔 동안만 방송된다.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig, saveAvatarConfig } from '@/lib/jeumto/storage'
import { emptyConfig, type AvatarConfig } from '@/lib/jeumto/config'
import { startHost, type HostHandle } from '@/lib/live/host'

export default function BroadcastPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<AvatarConfig | null>(null)
  const [onAir, setOnAir] = useState(false)
  const [viewers, setViewers] = useState(0)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [err, setErr] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hostRef = useRef<HostHandle | null>(null)
  const wakeRef = useRef<{ release(): Promise<void> } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login?redirect=/broadcast'); return }
      setUser(user)
      setConfig(await loadAvatarConfig(supabase, user.id))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!onAir) return
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [onAir])

  const setBroadcast = async (on: boolean) => {
    if (!user) return
    const base = config ?? emptyConfig()
    const next: AvatarConfig = { ...base, broadcast: { mode: 'camera', url: base.broadcast?.url ?? '', on } }
    const { error } = await saveAvatarConfig(supabase, user.id, next)
    if (!error) setConfig(next)
    return error
  }

  const start = async () => {
    if (!user) return
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true }
      hostRef.current = startHost(supabase, user.id, stream, setViewers)
      const e = await setBroadcast(true)
      if (e) throw new Error(e)
      setOnAir(true)
      try { wakeRef.current = await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* ignore */ }
    } catch (e) {
      hostRef.current?.stop(); hostRef.current = null
      setErr(e instanceof Error ? e.message : '카메라를 켤 수 없어요')
    }
  }
  const stop = async () => {
    hostRef.current?.stop(); hostRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    wakeRef.current?.release().catch(() => {}); wakeRef.current = null
    setOnAir(false); setViewers(0)
    await setBroadcast(false)
  }
  useEffect(() => () => { hostRef.current?.stop() }, [])
  // 페이지 떠나면(닫기/새로고침) 방송 OFF 로 — 이후 시청자에겐 '방송 준비 중' 대신 아바타가 나오도록
  useEffect(() => {
    if (!onAir || !user) return
    const h = () => {
      const base = config ?? emptyConfig()
      const body = JSON.stringify({ avatar_config: { ...base, broadcast: { mode: 'camera', url: base.broadcast?.url ?? '', on: false } } })
      // sendBeacon 은 supabase-js 를 못 쓰니 REST 로 직접 (세션 토큰 필요) — 최선의 노력
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (!token) return
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH', keepalive: true,
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body,
        }).catch(() => {})
      })
    }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [onAir, user, config, supabase])

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 px-4 h-12 shrink-0">
        <button onClick={async () => { if (onAir) await stop(); router.push('/profile') }} className="font-pixel text-[11px] text-white/70 tracking-widest">← 내정보</button>
        <span className="font-pixel text-[11px] tracking-widest text-[#ff6b8a]">📱 폰 카메라 방송</span>
        <div className="flex-1" />
        {onAir && <span className="font-pixel text-[10px] tracking-widest text-white/80">👥 {viewers} · {mmss}</span>}
      </div>
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
        {onAir && (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#e11d48] font-pixel text-[10px] px-2.5 py-1 tracking-widest">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> ON AIR
          </span>
        )}
        {!onAir && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm text-white/85 leading-relaxed">방송을 시작하면 내가 만든 게임을 플레이하는 사람에게 AJ 아바타 대신 <b>이 카메라 영상</b>이 BJ 자리에 나와요.<br />이 화면을 켜 둔 동안만 방송됩니다.</p>
            {err && <p className="text-[12px] text-red-400">{err}</p>}
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-3">
        <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={onAir} className="rounded-full bg-white/15 px-4 py-3 text-[12px] disabled:opacity-40">🔄 {facing === 'user' ? '전면' : '후면'}</button>
        {!onAir ? (
          <button onClick={start} disabled={!user} className="rounded-full bg-[#e11d48] px-8 py-3 font-pixel text-[12px] tracking-widest disabled:opacity-40">● 방송 시작</button>
        ) : (
          <button onClick={stop} className="rounded-full bg-white text-black px-8 py-3 font-pixel text-[12px] tracking-widest">■ 방송 종료</button>
        )}
      </div>
    </div>
  )
}
