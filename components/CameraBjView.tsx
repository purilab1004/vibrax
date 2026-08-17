'use client'
// 게임 내 BJ 박스 — 제작자의 폰 카메라 방송(WebRTC) 수신
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { startViewer, type ViewerState } from '@/lib/live/viewer'
import type { LiveInfo } from '@/lib/broadcast'

/** 링크(YouTube/Twitch) 방송 임베드 */
export function LinkLiveView({ src, aspect = 16 / 9, cover = false, badge = true, controls = false, controlsClass = 'top-3 right-3' }: { src: string; aspect?: number; cover?: boolean; badge?: boolean; controls?: boolean; controlsClass?: string }) {
  // 스피커 — YouTube 는 postMessage 로 mute/unMute/setVolume, Twitch/기타는 src 의 muted 파라미터를 바꿔 다시 로드
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(70)
  const isYT = /youtube\.com\/embed/.test(src)
  const [srcState, setSrcState] = useState({ base: src, live: src })
  const liveSrc = srcState.base === src ? srcState.live : src
  const setLiveSrc = (v: string) => setSrcState({ base: src, live: v })
  const yt = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    if (isYT) { yt(next ? 'mute' : 'unMute'); if (!next) yt('setVolume', [volume]) }
    else setLiveSrc(src.replace(/([?&])muted?=(true|1)/, `$1muted=${next ? 'true' : 'false'}`).replace(/([?&])mute=1/, `$1mute=${next ? 1 : 0}`))
  }
  const changeVolume = (v: number) => { setVolume(v); if (isYT) { yt('setVolume', [v]); if (v > 0 && muted) { setMuted(false); yt('unMute') } } }
  // 카드가 화면에서 벗어나면 소리를 끄고(YouTube 는 일시정지), 다시 들어오면 음소거 상태로 재생 — 다른 카드로 넘어가도 소리가 남지 않게
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      const vis = es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)
      if (!vis) {
        setMuted(true)
        if (isYT) { yt('mute'); yt('pauseVideo') }
        else setLiveSrc(src) // twitch/기타: 원본(muted) src 로 재로드
      } else if (isYT) { yt('playVideo') }
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT])
  // cover: 영상 비율(aspect)로 iframe 을 컨테이너보다 크게 잡아 여백 없이 꽉 채운다 (넘치는 부분은 잘림)
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (!cover || !ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [cover])
  let style: React.CSSProperties = {}
  if (cover && box) {
    const boxAspect = box.w / box.h
    // 유튜브는 재생 중 위(제목)/아래(공유·로고) 띠가 뜨므로 조금 더 키워(overscan) 그 부분을 카드 밖으로 잘라낸다
    const over = isYT ? 1.28 : 1
    const w = (boxAspect > aspect ? box.w : box.h * aspect) * over
    const h = (boxAspect > aspect ? box.w / aspect : box.h) * over
    style = { width: w, height: h, left: (box.w - w) / 2, top: (box.h - h) / 2, position: 'absolute' }
  }
  return (
    <div ref={(n) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = n; (boxRef as React.MutableRefObject<HTMLDivElement | null>).current = n }} className="relative w-full h-full bg-black overflow-hidden">
      {/* controls 모드(카드)에선 iframe 클릭/호버를 막아 유튜브 자체 UI 가 뜨지 않게 — 우리 스피커 버튼만 노출 */}
      <iframe ref={iframeRef} src={liveSrc} className={`${cover && box ? '' : 'absolute inset-0 w-full h-full'} ${controls ? 'pointer-events-none' : ''}`} style={style} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      {controls && (
        <div className={`absolute ${controlsClass} z-10 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-2 py-1`}>
          <button onClick={toggleMute} aria-label={muted ? '소리 켜기' : '음소거'} className="text-white text-[15px] leading-none w-7 h-7 flex items-center justify-center">
            {muted ? '🔇' : volume > 50 ? '🔊' : '🔉'}
          </button>
          {isYT && !muted && (
            <input type="range" min={0} max={100} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} className="w-20 accent-[#ffb62e]" aria-label="볼륨" />
          )}
        </div>
      )}
      {badge && (
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#e11d48] text-white font-pixel text-[9px] px-2 py-0.5 tracking-widest pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
        </span>
      )}
    </div>
  )
}

/** 라이브 종류에 따라 카메라(WebRTC) 또는 링크 임베드 */
export function LiveView({ live, cover = false, badge = true, controls = false, controlsClass }: { live: LiveInfo; cover?: boolean; badge?: boolean; controls?: boolean; controlsClass?: string }) {
  return live.kind === 'camera' ? <CameraBjView hostId={live.hostId} badge={badge} controls={controls} controlsClass={controlsClass} /> : <LinkLiveView src={live.src} aspect={live.aspect} cover={cover} badge={badge} controls={controls} controlsClass={controlsClass} />
}

export default function CameraBjView({ hostId, badge = true, controls = false, controlsClass = 'top-3 right-3' }: { hostId: string; badge?: boolean; controls?: boolean; controlsClass?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ViewerState>('connecting')
  const [muted, setMuted] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) setMuted(true) }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const supabase = createClient()
    const stop = startViewer(supabase, hostId, (s) => { if (videoRef.current) videoRef.current.srcObject = s }, setState)
    return stop
  }, [hostId])
  return (
    <div ref={boxRef} className="relative w-full h-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="absolute inset-0 w-full h-full object-cover" />
      {badge && (
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#e11d48] text-white font-pixel text-[9px] px-2 py-0.5 tracking-widest pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
        </span>
      )}
      {state === 'live' && (
        <div className={`absolute z-10 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-2 py-1 ${controls ? controlsClass : 'bottom-1.5 right-1.5'}`}>
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? '소리 켜기' : '음소거'} className="text-white text-[15px] leading-none w-7 h-7 flex items-center justify-center">{muted ? '🔇' : '🔊'}</button>
          {!muted && <input type="range" min={0} max={100} defaultValue={100} onChange={(e) => { if (videoRef.current) videoRef.current.volume = Number(e.target.value) / 100 }} className="w-20 accent-[#ffb62e]" aria-label="볼륨" />}
        </div>
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
