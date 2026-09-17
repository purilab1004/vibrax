'use client'
// 게임 내 BJ 박스 — 제작자의 폰 카메라 방송(WebRTC) 수신
import { useEffect, useRef, useState } from 'react'
import { getSoundPref, setSoundPref } from '@/lib/live/soundPref'
import { createClient } from '@/lib/supabase/client'
import { startViewer, type ViewerState } from '@/lib/live/viewer'
import type { LiveInfo } from '@/lib/broadcast'
import { localCamStream } from '@/lib/live/camLive'

/** 링크(YouTube/Twitch) 방송 임베드 */
// 스피커 필 — 꺼짐: '소리 켜기' 라벨, 켜짐: 움직이는 이퀄라이저 + 볼륨 슬라이더(선택). 유리 질감의 알약 모양
export function SoundPill({ muted, onToggle, volume, onVolume, className = '' }: { muted: boolean; onToggle: () => void; volume?: number; onVolume?: (v: number) => void; className?: string }) {
  return (
    <div className={`absolute z-10 flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-xl border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,.35)] pl-1.5 pr-2 py-1 text-white ${className}`}>
      <button onClick={onToggle} aria-label={muted ? '소리 켜기' : '음소거'} className="flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-full active:scale-95 transition-transform">
        {muted ? (
          <>
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
            <span className="text-[12px] font-bold tracking-tight">소리 켜기</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
            <span className="flex items-end gap-[2px] h-[14px]" aria-hidden>
              {[0, 1, 2, 3].map((i) => <span key={i} className="w-[3px] rounded-full bg-[#4cff6a] origin-bottom" style={{ height: 14, animation: `eq ${0.7 + i * 0.13}s ease-in-out ${i * 0.1}s infinite` }} />)}
            </span>
          </>
        )}
      </button>
      {!muted && onVolume && typeof volume === 'number' && (
        <input type="range" min={0} max={100} value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="w-16 h-1 accent-white cursor-pointer" aria-label="볼륨" />
      )}
    </div>
  )
}

export function LinkLiveView({ src, aspect = 16 / 9, cover = false, badge = true, controls = false, controlsClass = 'top-3 right-3' }: { src: string; aspect?: number; cover?: boolean; badge?: boolean; controls?: boolean; controlsClass?: string }) {
  // 스피커 — YouTube 는 postMessage 로 mute/unMute/setVolume, Twitch/기타는 src 의 muted 파라미터를 바꿔 다시 로드
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // 시작 상태는 공용 스피커 설정을 따른다 — 한 번 켜면 다른 영상도 켜진 채로 나온다
  const isYT = /youtube\.com\/embed/.test(src)
  // 소리 이어받기(자동으로 소리 켠 재생)는 앱과 데스크톱 브라우저만 — 모바일 브라우저는 제스처 없는 소리 재생을 막아 플레이어가 로딩에서 멈추므로 카드마다 탭해서 켠다
  const carry = typeof window !== 'undefined' && (/VibrexcupApp/.test(navigator.userAgent) || !window.matchMedia('(pointer: coarse)').matches)
  const [muted, setMuted] = useState(() => !(isYT && carry && getSoundPref().on))
  const [volume, setVolume] = useState(() => getSoundPref().volume)
  const [srcState, setSrcState] = useState({ base: src, live: src })
  const liveSrc = srcState.base === src ? srcState.live : src
  const setLiveSrc = (v: string) => setSrcState({ base: src, live: v })
  const yt = (func: string, args: unknown[] = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  // 유튜브 플레이어 상태(재생 중=1) 를 받아 둔다 — 모바일 브라우저는 제스처 없이 소리 켠 재생을 막아 '로딩'에서 멈추므로, 소리 켜기가 실패하면 음소거로 되돌려 재생한다
  const stateRef = useRef<number | null>(null) // 마지막 플레이어 상태(-1 시작 전, 0 끝, 1 재생, 2 일시정지, 3 버퍼링, 5 큐). null = 아직 모름
  const unmuteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isYT) return
    const onMsg = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d && d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number') stateRef.current = d.info.playerState } catch { /* noop */ }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [isYT])
  const listen = () => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'vbx' }), '*')
  // 소리 켠 채 재생 시도 → 플레이어가 '막혔다'고 알려줄 때만(시작 전/일시정지/큐 상태) 음소거로 폴백. 상태를 모르면 그대로 둔다(멀쩡히 재생 중인데 꺼지는 일 방지)
  const tryUnmutedPlay = () => {
    listen(); yt('playVideo'); yt('unMute'); yt('setVolume', [getSoundPref().volume])
    if (unmuteTimer.current) clearTimeout(unmuteTimer.current)
    stateRef.current = null
    const check = (again: boolean) => { const st = stateRef.current; if (st === -1 || st === 2 || st === 5) { yt('mute'); yt('playVideo'); setMuted(true) } else if (st === 3 && again) unmuteTimer.current = setTimeout(() => check(false), 1500); else if (st === 3) { yt('mute'); yt('playVideo'); setMuted(true) } }
    unmuteTimer.current = setTimeout(() => check(true), 1800)
  }
  const unmutedSrc = (s: string) => s.replace(/([?&])muted?=(true|1)/, '$1muted=false').replace(/([?&])mute=1/, '$1mute=0')
  const applyMute = (m: boolean) => {
    setMuted(m)
    if (isYT) { yt(m ? 'mute' : 'unMute'); if (!m) yt('setVolume', [volume]) }
    else setLiveSrc(m ? src : unmutedSrc(src))
  }
  const toggleMute = () => { if (unmuteTimer.current) clearTimeout(unmuteTimer.current); const next = !muted; applyMute(next); setSoundPref({ on: !next }) }
  const changeVolume = (v: number) => { setVolume(v); setSoundPref({ volume: v, on: v > 0 }); if (isYT) { yt('setVolume', [v]); if (v > 0 && muted) { setMuted(false); yt('unMute') } } }
  // 카드가 화면에서 벗어나면 소리를 끄고(YouTube 는 일시정지), 다시 들어오면 음소거 상태로 재생 — 다른 카드로 넘어가도 소리가 남지 않게
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      const vis = es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)
      if (!vis) {
        // 화면에서 벗어나면 이 카드만 조용히 — 공용 설정(켜짐)은 그대로 두어 다음 카드가 소리를 이어받는다
        setMuted(true)
        if (isYT) { yt('mute'); yt('pauseVideo') }
        else setLiveSrc(src) // twitch/기타: 원본(muted) src 로 재로드
      } else {
        const on = carry && getSoundPref().on
        if (isYT) { listen(); if (on) { setMuted(false); tryUnmutedPlay() } else { yt('playVideo'); setMuted(true) } }
        else setMuted(true) // Twitch/기타는 src 재로드가 필요해 자동으로 소리를 켜지 않는다(탭하면 켜짐)
      }
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => { io.disconnect(); if (unmuteTimer.current) clearTimeout(unmuteTimer.current) }
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
    const over = isYT ? 1.16 : 1
    const w = (boxAspect > aspect ? box.w : box.h * aspect) * over
    const h = (boxAspect > aspect ? box.w / aspect : box.h) * over
    style = { width: w, height: h, left: (box.w - w) / 2, top: (box.h - h) / 2, position: 'absolute' }
  }
  return (
    <div ref={(n) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = n; (boxRef as React.MutableRefObject<HTMLDivElement | null>).current = n }} className="relative w-full h-full bg-black overflow-hidden">
      {/* controls 모드(카드)에선 iframe 클릭/호버를 막아 유튜브 자체 UI 가 뜨지 않게 — 우리 스피커 버튼만 노출 */}
      <iframe ref={iframeRef} src={liveSrc} onLoad={() => { if (isYT) listen() }} className={`${cover && box ? '' : 'absolute inset-0 w-full h-full'} ${controls ? 'pointer-events-none' : ''}`} style={style} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      {controls && <SoundPill muted={muted} onToggle={toggleMute} volume={isYT ? volume : undefined} onVolume={isYT ? changeVolume : undefined} className={controlsClass} />}
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

export default function CameraBjView({ hostId, badge = true, controls = false, controlsClass = 'top-3 right-3', channel = 'cam', fit = 'cover' }: { hostId: string; badge?: boolean; controls?: boolean; controlsClass?: string; channel?: 'cam' | 'screen'; fit?: 'cover' | 'contain' }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<ViewerState>('connecting')
  const [isLocal, setIsLocal] = useState(false)   // 내 카메라(로컬) — 항상 음소거라 소리 버튼 없음
  const [muted, setMuted] = useState(true) // 처음엔 음소거로 재생을 시작하고, 재생이 붙은 뒤 공용 스피커 설정을 적용한다
  const [camVol, setCamVol] = useState(100)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver((es) => { if (!es.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) setMuted(true) }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    // 내가 방송 중인 카메라면(같은 탭에서 게임으로 이동) WebRTC 없이 로컬 스트림을 바로 — 내 목소리가 되울리지 않게 항상 음소거
    const local = channel === 'cam' ? localCamStream(hostId) : null
    if (local) {
      const v = videoRef.current
      if (v) { v.muted = true; v.srcObject = local; v.play().catch(() => {}) }
      const t = setTimeout(() => { setState('live'); setIsLocal(true) }, 0)
      return () => { clearTimeout(t); if (v) v.srcObject = null }
    }
    const supabase = createClient()
    // 스트림이 붙으면 반드시 '음소거'로 먼저 재생(제스처 없이 소리 켠 자동재생은 막혀 화면이 검게 남는다) → 재생이 시작된 뒤 공용 스피커 설정이 켜져 있으면 소리를 켠다
    const stop = startViewer(supabase, hostId, (s) => {
      const v = videoRef.current; if (!v) return
      v.muted = true; v.srcObject = s
      v.play().then(() => { if (getSoundPref().on) { v.muted = false; setMuted(false) } }).catch(() => { v.muted = true; setMuted(true) })
    }, setState, channel)
    return stop
  }, [hostId, channel])
  return (
    <div ref={boxRef} className="relative w-full h-full bg-black">
      <video ref={videoRef} autoPlay playsInline muted={muted} className={`absolute inset-0 w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`} />
      {badge && (
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-[#e11d48] text-white font-pixel text-[9px] px-2 py-0.5 tracking-widest pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
        </span>
      )}
      {state === 'live' && !isLocal && (
        <SoundPill muted={muted} onToggle={() => { const next = !muted; setMuted(next); setSoundPref({ on: !next }) }} volume={camVol} onVolume={(v) => { setCamVol(v); if (videoRef.current) videoRef.current.volume = v / 100 }} className={controls ? controlsClass : 'bottom-1.5 right-1.5'} />
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
