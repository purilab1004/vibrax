'use client'
// 게임 내 BJ 박스 — 제작자의 폰 카메라 방송(WebRTC) 수신
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startViewer, type ViewerState } from '@/lib/live/viewer'

export default function CameraBjView({ hostId }: { hostId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ViewerState>('connecting')
  const [muted, setMuted] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    const stop = startViewer(supabase, hostId, (s) => { if (videoRef.current) videoRef.current.srcObject = s }, setState)
    return stop
  }, [hostId])
  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#e11d48] text-white font-pixel text-[9px] px-2 py-0.5 tracking-widest pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
      </span>
      {state === 'live' && (
        <button onClick={() => setMuted((m) => !m)} className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 text-white text-[11px] px-2 py-1">
          {muted ? '🔇 소리 켜기' : '🔊'}
        </button>
      )}
      {state !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/85 text-[11px] font-pixel tracking-widest bg-black/50">
          <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          {state === 'waiting' ? '방송 준비 중…' : state === 'ended' ? '방송 종료' : '연결 중…'}
        </div>
      )}
    </div>
  )
}
