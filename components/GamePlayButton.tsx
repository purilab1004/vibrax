'use client'

import Link from 'next/link'
import { playSrc, IOS_IFRAME_FIT } from '@/lib/game-src'
import { useNetBridge } from '@/lib/net/useNetBridge'
import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'
import { loadAvatarConfig, saveAvatarConfig } from '@/lib/jeumto/storage'
import { emptyConfig } from '@/lib/jeumto/config'
import { startHost, type HostHandle } from '@/lib/live/host'
import { getCamLive, subscribeCamLive } from '@/lib/live/camLive'
import dynamic from 'next/dynamic'
import { useLiveBroadcasts, liveForGame, refreshLiveBroadcasts } from '@/lib/live/useLiveBroadcasts'
import { useGameTelemetry } from '@/lib/aj/telemetry'
import type { AvatarConfig } from '@/lib/jeumto/config'
import AiBjPanel from './AiBjPanel'
const CameraBjView = dynamic(() => import('./CameraBjView'), { ssr: false })
import PlayHeader from './PlayHeader'
import { SlotChooser, SlotPanel } from './SaveSlots'
import type { SlotNo, SlotSummary } from '@/lib/game-saves'
import TransportBar, { type Cand } from './TransportBar'
import { hasCoinTicket, ticketKeyOf } from './GameCard'

const GENRE_LABELS: Record<string, string> = { action: 'ACTION', adventure: 'ADVENTURE', strategy: 'STRATEGY', sports: 'SPORTS', arcade: 'ARCADE' }
const GENRE_COLORS: Record<string, string> = { action: 'bg-red-700', adventure: 'bg-amber-700', strategy: 'bg-blue-700', sports: 'bg-green-700', arcade: 'bg-sky-600' }

interface Props {
  game: Game
  genreColor: string
  genreLabel: string
  bjName?: string | null   // 제작자 공개 표시명(에이전트 이름) — 하단 BJ 프로필용
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

export default function GamePlayButton({ game: initialGame, genreColor: initialColor, genreLabel: initialLabel, bjName: initialBj }: Props) {
  // transport 로 게임이 바뀌면 오버레이는 그대로 두고 이 상태만 갈아끼운다
  const [cur, setCur] = useState<{ game: Game; genreColor: string; genreLabel: string; bjName?: string | null }>({ game: initialGame, genreColor: initialColor, genreLabel: initialLabel, bjName: initialBj })
  const game = cur.game, genreColor = cur.genreColor, genreLabel = cur.genreLabel, bjName = cur.bjName
  const [open, setOpen] = useState(false)
  const [warp, setWarp] = useState<'out' | 'hold' | 'in' | null>(null)   // 텔레포트 연출 단계
  // 플랫폼 공통 일시정지 — 게임 iframe 에 {type:'vibrex:pause'} 를 보내면 PAUSE_SHIM 이 루프·타이머·오디오를 멈춘다
  const [paused, setPaused] = useState(false)
  // 가로/세로 전환(모바일) — 화면 방향 잠금 API 는 iOS 가 지원하지 않아, 게임 박스를 90° 회전시켜 가로 뷰포트로 보여준다
  const [rotated, setRotated] = useState(false)
  const [vp, setVp] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!open) return
    const read = () => setVp(v => (v.w === window.innerWidth && v.h === window.innerHeight) ? v : { w: window.innerWidth, h: window.innerHeight })
    const ts = [0, 250, 600, 1200, 2500].map(ms => setTimeout(read, ms))
    window.addEventListener('resize', read); window.visualViewport?.addEventListener('resize', read)
    return () => { ts.forEach(clearTimeout); window.removeEventListener('resize', read); window.visualViewport?.removeEventListener('resize', read) }
  }, [open])
  useEffect(() => { if (open) return; const t = setTimeout(() => setRotated(false), 0); return () => clearTimeout(t) }, [open])
  // 오버레이 전체(헤더·게이지·게임·AJ 채팅/아바타)를 90° 회전 — 폭·높이를 맞바꿔 가로 화면처럼
  const rotStyle: React.CSSProperties | undefined = rotated && vp.w > 0 ? { position: 'absolute', inset: 'auto', top: (vp.h - vp.w) / 2, left: (vp.w - vp.h) / 2, width: vp.h, height: vp.w, transform: 'rotate(90deg)', transformOrigin: 'center' } : undefined
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const togglePause = () => { const next = !paused; setPaused(next); try { frameRef.current?.contentWindow?.postMessage({ type: 'vibrex:pause', on: next }, '*') } catch { /* */ } }
  useEffect(() => {
    if (!open) return
    const h = (e: MessageEvent) => { const d = e.data as { type?: string; on?: boolean } | null; if (d && d.type === 'vibrex:paused') setPaused(!!d.on) }
    window.addEventListener('message', h); return () => window.removeEventListener('message', h)
  }, [open])
  useEffect(() => { if (open) return; const t = setTimeout(() => setPaused(false), 0); return () => clearTimeout(t) }, [open])
  // 네이티브 앱(iOS/Android) — 플레이 중엔 하단 탭바·상단 상태바 영역을 없애 게임이 전체 화면을 채우게 한다
  useEffect(() => {
    if (!open) return
    const w = window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }
    const post = (on: boolean) => { try { w.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'play', on })) } catch { /* */ } }
    post(true)
    return () => post(false)
  }, [open])
  // 앱 전체 화면일 때 카메라(다이내믹 아일랜드)·홈바 여백 — 새 앱은 window.VIBREX_INSETS(실측), 구 앱은 iPhone 화면 높이(pt) 로 추정, 그 외 env() 만
  const [safe, setSafe] = useState({ top: 0, bottom: 0 })
  useEffect(() => {
    if (!open) return
    const w = window as unknown as { VIBREX_INSETS?: { top?: number; bottom?: number } }
    const calc = () => {
      if (w.VIBREX_INSETS) return { top: w.VIBREX_INSETS.top ?? 0, bottom: w.VIBREX_INSETS.bottom ?? 0 }
      if (!/VibrexcupApp\/[\d.]+ \(ios\)/i.test(navigator.userAgent)) return { top: 0, bottom: 0 }
      const h = Math.max(window.screen.width, window.screen.height)
      const top = h >= 870 ? 62 : h === 852 || h === 932 ? 59 : h >= 812 ? 47 : 0
      return { top, bottom: top ? 34 : 0 }
    }
    const t = setTimeout(() => setSafe(calc()), 0)
    return () => clearTimeout(t)
  }, [open])
  // 헤더가 게임 위에 겹치므로, 게임 쪽 상단 UI(AI PLAYING 배지·HUD)가 피해야 할 높이 = safe-area + 버튼 줄(56)
  const headerBottom = (rotated ? (safe.top ? 6 : 0) : safe.top) + 56
  // safe-area 변수 — 세로: 위 카메라·아래 홈바. 가로(90° 회전): 회전된 위/아래 = 기기 좌/우 모서리(라운드) → 20px, 회전된 왼쪽 = 기기 위(카메라), 오른쪽 = 기기 아래(홈바 21)
  const safeVars: Record<string, string> = rotated
    ? { '--vbx-safe-top': `${safe.top ? 6 : 0}px`, '--vbx-safe-bottom': `${safe.top ? 20 : 0}px`, '--vbx-safe-left': `${safe.top}px`, '--vbx-safe-right': `${safe.top ? 21 : 0}px` }
    : { '--vbx-safe-top': `max(env(safe-area-inset-top, 0px), ${safe.top}px)`, '--vbx-safe-bottom': `max(env(safe-area-inset-bottom, 0px), ${safe.bottom}px)`, '--vbx-safe-left': '0px', '--vbx-safe-right': '0px' }
  // 게임에 알리는 호스트 정보 — bottomInset: 하단 AJ 띠+홈바(조이스틱 위치), topInset: AI PLAYING 배지 위치(헤더가 겹칠 때 56, 띠일 땐 8)
  const hostMsg = () => ({ type: 'vibrex:host', pause: true, bottomInset: (window.matchMedia('(max-width: 767px)').matches ? 56 : 0) + (rotated ? (safe.top ? 20 : 0) : safe.bottom), topInset: headerBottom, leftInset: rotated ? 44 : 0 })  // 가로: 조이스틱을 기기 위쪽(카메라 쪽) 모서리에서 조금 더 안쪽으로
  useEffect(() => {
    if (!open) return
    try { frameRef.current?.contentWindow?.postMessage({ ...hostMsg(), pause: undefined }, '*') } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerBottom, safe.bottom])
  useNetBridge(open, () => frameRef.current, cur.game.id) // 온라인 게임 브리지 (Realtime 중계)
  // 텔레포트로 게임이 바뀌면 주소창·탭 제목을 새 게임으로 바꾼다(페이지 자체는 그대로 두어 플레이가 끊기지 않게). 닫을 때 새 게임 페이지로 이동
  const startedId = useRef(cur.game.id)
  useEffect(() => {
    if (!open || cur.game.id === startedId.current) return
    try { window.history.replaceState(window.history.state, '', `/games/${cur.game.id}`); document.title = `${cur.game.title} | Vibrexcup` } catch { /* noop */ }
  }, [open, cur.game.id, cur.game.title])
  const close = () => { setOpen(false); if (cur.game.id !== startedId.current) { startedId.current = cur.game.id; router.replace(`/games/${cur.game.id}`) } }
  useGameTelemetry(game.id, open) // AJ 텔레메트리 — 플레이 세션 기록 (게임이 바뀌면 새 세션)
  const [agentGate, setAgentGate] = useState<'login' | 'agent' | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [bjAvatarConfig, setBjAvatarConfig] = useState<AvatarConfig | null>(null)
  const [myAvatarConfig, setMyAvatarConfig] = useState<AvatarConfig | null>(null)  // 시청자(나)의 아바타 — 무대에 서고 게임에 참여한다
  const supabase = createClient()
  const router = useRouter()
  const liveMap = useLiveBroadcasts()
  const [isGuest, setIsGuest] = useState(false)
  const [me, setMe] = useState<string | null>(null)
  // 이 게임의 회원 라이브 — 화면 방송(screen)이면 다른 회원은 관전만(방을 연 회원만 플레이), 폰 카메라(cam)는 BJ 자리에 나온다
  const liveEntry = liveForGame(liveMap, game.id)
  const bjLive = liveEntry && liveEntry.kind === 'camera' && !liveEntry.cam ? null : liveEntry
  // 내 플레이 화면 방송(캔버스 캡처 → WebRTC) — 헤더의 '방송' 버튼
  const [screenLive, setScreenLive] = useState<{ viewers: number } | null>(null)
  const screenHost = useRef<HostHandle | null>(null)
  const screenStream = useRef<MediaStream | null>(null)
  const captureCleanup = useRef<(() => void) | null>(null)   // 게임 캡처 브리지 끄기
  // 온라인(멀티) 게임은 라이브 중에도 다른 회원이 함께 플레이할 수 있다 — 관전은 싱글 게임만
  const spectate = !!(open && !screenLive && liveEntry && liveEntry.kind === 'camera' && (liveEntry.screen || liveEntry.cam) && liveEntry.hostId !== me && game.play_mode !== 'multi')
  // 라이브 방송 중(내가 화면·카메라로 이 게임을 방송하거나, 남의 방송을 관전)이면 다음 게임으로 넘어가지 않는다
  const camLiveGame = useSyncExternalStore(subscribeCamLive, () => getCamLive()?.gameId ?? null, () => null)
  const liveLocked = !!screenLive || spectate || camLiveGame === game.id
  const stopScreenLive = async (persist = true) => {
    screenHost.current?.stop(); screenHost.current = null
    screenStream.current?.getTracks().forEach(t => t.stop()); screenStream.current = null
    captureCleanup.current?.(); captureCleanup.current = null
    setScreenLive(null)
    if (!persist) return
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return
      const cfg = await loadAvatarConfig(supabase, user.id)
      if (cfg?.broadcast?.screenOn) await saveAvatarConfig(supabase, user.id, { ...cfg, broadcast: { ...cfg.broadcast, screenOn: false } })
    } catch { /* noop */ }
  }
  // 폰에선 게임·카메라·얼굴 인식이 함께 돌아 무거우므로 화면 방송은 가볍게(조작 지연 방지)
  const capOpts = () => (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? { fps: 20, maxW: 720 } : { fps: 30, maxW: 1280 })
  const startScreenLive = async (auto = false) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    let stream: MediaStream | null = null
    // 1) 게임 캔버스 캡처 — /play 는 sandbox(opaque origin)라 직접 접근이 안 되므로, 게임 안 캡처 브리지가 보내 주는 프레임(ImageBitmap)을
    //    내 캔버스에 그려 captureStream 으로 방송한다. 시청자 화면엔 헤더·채팅 없이 게임만 나오고, 모바일 브라우저에서도 된다.
    //    게임이 늦게 뜰 수 있어 첫 프레임을 기다린다(자동 시작 최대 ~12초, 버튼은 ~4초)
    const cap = document.createElement('canvas')
    cap.width = 2; cap.height = 2
    Object.assign(cap.style, { position: 'fixed', left: '-10000px', top: '0', width: '2px', height: '2px', pointerEvents: 'none' })
    document.body.appendChild(cap)
    const cctx = cap.getContext('2d')
    let gotFrame = false
    const onFrame = (e: MessageEvent) => {
      const d = e.data as { type?: string; w?: number; h?: number; bm?: ImageBitmap } | null
      if (!d || d.type !== 'vibrex:frame' || !d.bm || e.source !== frameRef.current?.contentWindow) return
      if (cap.width !== d.w || cap.height !== d.h) { cap.width = d.w!; cap.height = d.h! }
      cctx?.drawImage(d.bm, 0, 0); d.bm.close(); gotFrame = true
    }
    window.addEventListener('message', onFrame)
    const askFrames = () => { try { frameRef.current?.contentWindow?.postMessage({ type: 'vibrex:capture', on: true, ...capOpts() }, '*') } catch { /* */ } }
    for (let i = 0; !gotFrame && i < (auto ? 15 : 5); i++) { askFrames(); await new Promise(r => setTimeout(r, 800)) }
    const capWithStream = cap as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
    if (gotFrame && capWithStream.captureStream) {
      stream = capWithStream.captureStream(capOpts().fps)
      captureCleanup.current = () => { window.removeEventListener('message', onFrame); try { frameRef.current?.contentWindow?.postMessage({ type: 'vibrex:capture', on: false }, '*') } catch { /* */ } cap.remove() }
    } else { window.removeEventListener('message', onFrame); cap.remove() }
    // 2) 캔버스가 없으면(DOM 게임) 화면 공유로 — 모바일은 화면 공유를 지원하지 않아 자동 시작에선 건너뛴다
    if (!stream) {
      if (auto && !navigator.mediaDevices?.getDisplayMedia) return
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, ...({ preferCurrentTab: true, selfBrowserSurface: 'include' } as object) }) } catch { return }
    }
    // 마이크(있으면) — 해설 소리
    // 카메라 방송(camLive) 중이면 마이크는 이미 그쪽으로 나간다 — 다시 요청하면 iOS 가 기존 카메라 트랙을 끊을 수 있어 건너뛴다
    if (!getCamLive()) { try { const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); mic.getAudioTracks().forEach(t => stream!.addTrack(t)) } catch { /* 마이크 없이 */ } }
    screenStream.current = stream
    stream.getVideoTracks()[0]?.addEventListener('ended', () => { void stopScreenLive() })
    screenHost.current = startHost(supabase, user.id, stream, (n) => setScreenLive(s => (s ? { ...s, viewers: n } : s)), 'screen')
    setScreenLive({ viewers: 0 })
    try {
      const cfg = (await loadAvatarConfig(supabase, user.id)) ?? emptyConfig()
      await saveAvatarConfig(supabase, user.id, { ...cfg, broadcast: { ...(cfg.broadcast ?? { mode: 'avatar', url: '', on: false }), screenOn: true, gameId: game.id } })
    } catch { /* noop */ }
  }
  const toggleScreenLive = () => { if (screenLive) void stopScreenLive(); else void startScreenLive() }
  // 오버레이를 닫거나 다른 게임으로 넘어가면 방송 종료
  useEffect(() => { if (!open) return; return () => { if (screenHost.current) void stopScreenLive() } // eslint-disable-line react-hooks/exhaustive-deps
  }, [open, game.id])
  // 페이지를 떠나면(닫기/새로고침) screenOn 을 끈다 — 최선의 노력
  useEffect(() => {
    if (!screenLive) return
    const h = () => {
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token; const uid = data.session?.user.id; if (!token || !uid) return
        loadAvatarConfig(supabase, uid).then(cfg => {
          if (!cfg?.broadcast) return
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', keepalive: true, headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ avatar_config: { ...cfg, broadcast: { ...cfg.broadcast, screenOn: false } } }) }).catch(() => {})
        }).catch(() => {})
      })
    }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [screenLive, supabase])
  const { T } = useLang()

  // 모달이 열리면 뒤 홈페이지 스크롤 잠금
  useEffect(() => {
    if (!open && !agentGate) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, agentGate])

  const playLock = useRef(false)
  const handlePlay = async () => {
    if (playLock.current || open) return   // 두 번 눌러도 코인은 한 번만
    playLock.current = true
    setTimeout(() => { playLock.current = false }, 1500)
    const { data: { user } } = await supabase.auth.getUser()
    setMe(user?.id ?? null)
    if (!user) {
      // 게스트 플레이 — 공유 링크로 온 방문자는 로그인 없이 게임만 바로 플레이.
      // AJ 방송/채팅은 로그인 안내 패널로 대체 (코인 차감 없음)
      setIsGuest(true)
      setAgentConfig(null)
      loadAvatarConfig(supabase, game.user_id).then(setBjAvatarConfig).catch(() => {})
      setOpen(true)
      supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
      return
    }
    setIsGuest(false)
    const name = user.user_metadata?.agent_name?.trim()
    if (!name) { setAgentGate('agent'); return }
    // 🪙 코인 투입 — 카드에서 이미 넣었다면(티켓) 이중 차감하지 않는다
    if (hasCoinTicket(game.id)) {
      try { sessionStorage.removeItem(ticketKeyOf(game.id)) } catch {}
    } else {
      const { error: coinError } = await supabase.rpc('spend_credits_for_game', { p_game_id: game.id } as never)
      if (coinError) {
        if (/insufficient_vcoin|INSUFFICIENT_CREDITS/.test(coinError.message)) {
          alert(T.games.insufficientCoin)
          return
        }
        // 마이그레이션 전/일시 오류 — 플레이는 막지 않는다
        console.warn('vcoin spend skipped:', coinError.message)
      }
    }
    const persona = user.user_metadata?.agent_persona?.trim()
    const avatarUrl = user.user_metadata?.agent_avatar_url ?? ''
    setAgentConfig({ name, persona: persona ?? '', avatarUrl })
    // 게임 제작자의 저장된 아바타를 BJ 로 사용 (없으면 AiBjPanel 이 기본 아바타 fallback) + 내 아바타
    loadAvatarConfig(supabase, game.user_id).then(setBjAvatarConfig).catch(() => {})
    loadAvatarConfig(supabase, user.id).then(cfg => {
      setMyAvatarConfig(cfg)
      // 내가 /broadcast 에서 이 게임으로 라이브(폰 카메라) 중이면, 게임을 열자마자 내 플레이 화면 방송도 자동으로 켠다 — 시청자에게 게임 화면 + 얼굴이 함께 나온다
      if (cfg?.broadcast?.mode === 'camera' && cfg.broadcast.on && cfg.broadcast.gameId === game.id) setTimeout(() => { if (!screenHost.current) void startScreenLive(true) }, 1500)
    }).catch(() => {})
    refreshLiveBroadcasts()
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

  // 게임 저장 — 게임 안 localStorage 를 통째로 받아 계정에 보관(기기가 바뀌어도 이어하기). 게임마다 슬롯 최대 3칸.
  //  시작할 때 저장이 있으면 어느 슬롯으로 이어할지(또는 처음부터) 고르고, 그 슬롯이 '플레이 중 슬롯'이 되어 자동 저장도 거기로 간다.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'guest' | 'fail' | 'empty'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slots, setSlots] = useState<(SlotSummary | null)[] | null>(null)     // null = 아직 불러오는 중
  const [slotChoice, setSlotChoice] = useState<SlotNo | 'new' | null>(null)   // 시작 선택 (null 이면 고르는 창)
  const [restartNonce, setRestartNonce] = useState(0)
  const [slotPanel, setSlotPanel] = useState(false)
  const [slotMsg, setSlotMsg] = useState<string | null>(null)
  const curSlot = useRef<SlotNo | null>(null)          // 플레이 중 슬롯 — 자동 저장 대상
  const [curSlotView, setCurSlotView] = useState<SlotNo | null>(null)   // 화면 표시용 사본
  const setPlaySlot = (n: SlotNo | null) => { curSlot.current = n; setCurSlotView(n) }
  const manualSlot = useRef<SlotNo | null>(null)       // 💾 패널에서 고른 슬롯 (응답 기다리는 중)
  const flashSave = useCallback((st: 'saved' | 'guest' | 'fail' | 'empty', ms = 2200) => {
    setSaveState(st)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveState('idle'), ms)
  }, [])
  // 게임을 열 때마다 슬롯 목록을 새로 받는다
  useEffect(() => {
    if (!open) { const t = setTimeout(() => { setSlots(null); setSlotChoice(null); setSlotPanel(false); setPlaySlot(null) }, 0); return () => clearTimeout(t) }
    let alive = true
    fetch(`/api/game-save?gameId=${game.id}`).then(r => r.ok ? r.json() : null).then((j: { slots?: (SlotSummary | null)[]; guest?: boolean } | null) => {
      if (!alive) return
      const list = j?.slots ?? [null, null, null]
      setSlots(list)
      if (j?.guest || !list.some(Boolean)) {
        // 저장이 없으면 고를 것도 없다 — 바로 새로 시작, 자동 저장은 1번 칸
        setPlaySlot(j?.guest ? null : 1)
        setSlotChoice('new')
      }
    }).catch(() => { if (alive) { setSlots([null, null, null]); setSlotChoice('new') } })
    return () => { alive = false }
  }, [open, game.id])
  const pickStart = (c: SlotNo | 'new') => {
    if (c === 'new') {
      // 새로 하기 — 빈 칸이 있으면 그 칸에 자동 저장, 3칸이 다 차 있으면 직접 고를 때까지 자동 저장하지 않는다
      const empty = (slots ?? []).findIndex(v => !v)
      setPlaySlot(empty >= 0 ? ((empty + 1) as SlotNo) : null)
    } else setPlaySlot(c)
    setSlotChoice(c)
  }
  const putSave = useCallback(async (data: Record<string, string>, manual: boolean) => {
    // 게임이 아직 아무것도 저장하지 않았으면(시작 전) 보내지 않는다 — 기존 저장을 빈 값으로 덮어쓰지 않게
    if (!data || Object.keys(data).length === 0) { if (manual) { flashSave('empty', 2600); setSlotMsg('아직 저장할 진행이 없어요 — 게임을 조금 진행한 뒤 저장하세요') } return }
    const slot = manual ? manualSlot.current : curSlot.current
    if (!slot) return
    try {
      const r = await fetch('/api/game-save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: game.id, slot, data }) })
      if (r.status === 401) { if (manual) flashSave('guest'); return }
      if (r.ok) {
        const j = await r.json().catch(() => null) as { slots?: (SlotSummary | null)[] } | null
        if (j?.slots) setSlots(j.slots)
        if (manual) { setPlaySlot(slot); manualSlot.current = null; flashSave('saved', 1800); setSlotMsg(`${slot}번 슬롯에 저장했어요`) }
        return
      }
      console.warn('[game-save] 실패', r.status, await r.text().catch(() => ''))
      if (manual) { flashSave('fail', 2600); setSlotMsg('저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요') }
    } catch (e) { console.warn('[game-save]', e); if (manual) flashSave('fail', 2600) }
  }, [game.id, flashSave])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; data?: Record<string, string> } | null
      if (d?.type === 'vibrex:save-data' && d.data) void putSave(d.data, saveState === 'saving' && !!manualSlot.current)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [putSave, saveState])
  // 이어하기 안전장치 — 서버가 주입하지 못한 경우(외부 게임 등) 고른 슬롯의 저장본을 프레임에 넣어 준다. 새로 하기면 넣지 않는다
  useEffect(() => {
    if (!open || !slotChoice || slotChoice === 'new') return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/game-save?gameId=${game.id}&slot=${slotChoice}`)
        if (!r.ok) return
        const j = await r.json() as { save?: Record<string, string> | null }
        if (!alive || !j.save || !Object.keys(j.save).length) return
        frameRef.current?.contentWindow?.postMessage({ type: 'vibrex:save-restore', data: j.save }, '*')
      } catch { /* noop */ }
    }, 1200)
    return () => { alive = false; clearTimeout(t) }
  }, [open, game.id, slotChoice, restartNonce])

  // 💾 — 슬롯 패널 열기 (비회원은 로그인 안내)
  const saveNow = () => {
    if (isGuest) { flashSave('guest'); return }
    setSlotMsg(null); setSlotPanel(true)
  }
  const saveToSlot = (n: SlotNo) => {
    const el = frameRef.current
    if (!el?.contentWindow) { flashSave('fail'); return }
    manualSlot.current = n
    setSaveState('saving'); setSlotMsg(null)
    el.contentWindow.postMessage({ type: 'vibrex:save-dump' }, '*')
    // 게임이 응답하지 않으면(옛 버전 캐시 등) 계속 도는 대신 실패로 알린다
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaveState(st => { if (st === 'saving') { manualSlot.current = null; setSlotMsg('게임이 응답하지 않아 저장하지 못했어요'); return 'fail' } return st }), 4000)
  }
  const deleteSlot = async (n: SlotNo) => {
    const r = await fetch(`/api/game-save?gameId=${game.id}&slot=${n}`, { method: 'DELETE' }).catch(() => null)
    const j = r?.ok ? await r.json().catch(() => null) as { slots?: (SlotSummary | null)[] } | null : null
    if (!j?.slots) { setSlotMsg('지우지 못했어요'); return }
    setSlots(j.slots)
    if (curSlot.current === n) setPlaySlot(null)     // 지운 칸에는 자동 저장하지 않는다(다시 고를 때까지)
    setSlotMsg(`${n}번 슬롯을 지웠어요`)
  }
  const restartFresh = () => {
    // 처음부터 — 저장본을 심지 않고 게임을 새로 불러온다. 자동 저장은 빈 칸이 있을 때만
    const empty = (slots ?? []).findIndex(v => !v)
    setPlaySlot(empty >= 0 ? ((empty + 1) as SlotNo) : null)
    setSlotChoice('new'); setRestartNonce(v => v + 1); setSlotPanel(false); setPaused(false)
  }
  // 우리 게임(/play/…)은 고른 슬롯을 주소에 실어 서버가 그 저장본을 먼저 심게 한다
  const srcFor = (g: Game) => {
    const base = playSrc(g)
    if (g.id !== game.id || !slotChoice || !base.includes('/play/') || base.includes('/play/ext/')) return base
    return `${base}${base.includes('?') ? '&' : '?'}slot=${slotChoice}${restartNonce ? `&r=${restartNonce}` : ''}`
  }

  // 상단 바(일시정지·게이지·닫기) 숨기기 — 모바일에서 실수로 닫는 것을 막고 화면을 넓게 쓴다. 선택은 기기에 기억한다
  const [hudHidden, setHudHidden] = useState(false)
  useEffect(() => { const t = setTimeout(() => { try { setHudHidden(localStorage.getItem('vbx_hud_hidden') === '1') } catch { /* noop */ } }, 0); return () => clearTimeout(t) }, [])
  const toggleHud = (hide: boolean) => { setHudHidden(hide); try { localStorage.setItem('vbx_hud_hidden', hide ? '1' : '0') } catch { /* noop */ } }

  // 텔레포트 — TransportBar 가 고른 다음 게임으로 오버레이 안에서 바로 전환 (START 화면을 거치지 않음)
  //  out(현재 게임 빨려들어감, 그동안 코인 차감·다음 게임 iframe 을 뒤에서 미리 로드) → hold(로드 끝날 때까지 파동만) → in(새 게임 튀어나옴)
  const [pending, setPending] = useState<Game | null>(null)
  const pendingLoaded = useRef(false)
  useEffect(() => {
    if (!open) return
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const h = async (e: Event) => {
      const c = (e as CustomEvent<Cand>).detail
      if (!c?.id || !c.play_url || warp) return
      e.preventDefault()
      const g: Game = { ...game, id: c.id, title: c.title, genre: c.genre as Game['genre'], thumbnail_url: c.thumbnail_url, play_url: c.play_url, user_id: c.user_id, description: c.description, language: c.language, coin_cost: c.coin_cost, studio_project_id: null, teaser: null, teaser_en: null, goal_score: null }
      pendingLoaded.current = false
      setPending(g); setWarp('out')
      // 코인 — 로그인 사용자는 평소처럼 차감 (부족하면 이동 취소). 애니메이션과 동시에 진행해 멈칫하지 않게
      const pay = (async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return true
        const { error } = await supabase.rpc('spend_credits_for_game', { p_game_id: c.id } as never)
        return !(/insufficient_vcoin|INSUFFICIENT_CREDITS/.test(error?.message ?? ''))
      })()
      const [ok] = await Promise.all([pay, sleep(560)])
      if (!ok) { setWarp(null); setPending(null); alert(T.games.insufficientCoin); return }
      setWarp('hold')
      for (let i = 0; i < 50 && !pendingLoaded.current; i++) await sleep(50)   // 최대 2.5초 — 로드가 끝나면 즉시
      setCur({ game: g, genreColor: GENRE_COLORS[c.genre] ?? 'bg-gray-700', genreLabel: (GENRE_LABELS[c.genre] ?? c.genre).toUpperCase(), bjName: null }); setPaused(false)
      setPending(null)
      loadAvatarConfig(supabase, c.user_id).then(setBjAvatarConfig).catch(() => {})
      supabase.rpc('increment_view_count', { game_id: c.id }).then(() => {})
      try { window.history.replaceState(null, '', `/games/${c.id}`) } catch { /* */ }
      setWarp('in')
      await sleep(720)
      setWarp(null)
    }
    window.addEventListener('vibrex:teleport', h)
    return () => window.removeEventListener('vibrex:teleport', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game, warp])

  // transport 로 넘어온 경우(?play=1) 자동으로 플레이 시작 — 게임을 끝내면 끊기지 않고 다음 게임으로 이어진다
  const autoRef = useRef(false)
  const startBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (autoRef.current) return
    let play = false
    try { play = new URLSearchParams(window.location.search).get('play') === '1' } catch { /* */ }
    if (!play) return
    // 잠금·주소 정리는 타이머 안에서 — 개발 모드 StrictMode 의 이펙트 두 번 실행(정리→재실행)에 자동 시작이 취소되지 않게
    // 페이지에 START 가 두 개(모바일·PC) — 화면에 보이는 쪽만 시작
    const t = setTimeout(() => {
      if (autoRef.current || !startBtnRef.current || startBtnRef.current.offsetParent === null) return
      autoRef.current = true
      try { window.history.replaceState(null, '', window.location.pathname) } catch { /* */ }
      void handlePlay()
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* 아케이드 START — 카드 뒷면과 같은 빨간 돔 버튼, 큼직하게 */}
      <button
        ref={startBtnRef}
        onClick={handlePlay}
        className="shrink-0 rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[13px] tracking-[0.2em] px-10 h-12 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),0_4px_0_#8f1508,0_8px_16px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),0_2px_0_#8f1508] transition-all whitespace-nowrap"
      >
        ▶ START
      </button>

      {agentGate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4" onClick={() => setAgentGate(null)}>
          <div className="w-full max-w-sm bg-[#fcfaf5] border border-purple-700/60" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#ebe4d6] flex items-center justify-between">
              <span className="font-pixel text-[11px] text-purple-400 tracking-widest">AGENT REQUIRED</span>
              <button onClick={() => setAgentGate(null)} className="text-[#9d9280] hover:text-[#241f17] text-lg">✕</button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {agentGate === 'login' ? (
                <>
                  <p className="text-[#241f17] text-sm font-semibold">로그인이 필요해요</p>
                  <p className="text-[#6b6152] text-xs leading-relaxed">게임에 참여하려면 로그인 후 나만의 AGENT를 만들어야 해요.</p>
                  <button onClick={() => router.push('/login')} className="w-full font-pixel text-[11px] bg-[#2563eb] text-white py-3 hover:bg-[#1d4ed8] transition-colors tracking-widest">
                    → 로그인하기
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[#241f17] text-sm font-semibold">AGENT를 먼저 만들어주세요</p>
                  <p className="text-[#6b6152] text-xs leading-relaxed">
                    게임 참여는 나만의 AI AGENT가 필요해요.<br />
                    AGENT는 게임 중 AI 스트리머 AJ와 실시간으로 대화하며 방송의 흥을 이어가줘요.
                  </p>
                  <div className="border border-purple-900/40 bg-purple-900/10 px-4 py-3 space-y-1">
                    <p className="text-[11px] text-[#6b6152]">• 이름과 성격을 설정하면 그대로 행동</p>
                    <p className="text-[11px] text-[#6b6152]">• 내가 게임할 동안 AJ와 채팅 대신</p>
                    <p className="text-[11px] text-[#6b6152]">• 프로필 → MY AGENT에서 1분이면 완료</p>
                  </div>
                  <Link href="/profile" className="block w-full font-pixel text-[11px] bg-purple-700 text-white py-3 hover:bg-purple-600 transition-colors tracking-widest text-center">
                    🤖 AGENT 만들러 가기
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black"
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className={`${rotated ? '' : 'absolute inset-0'} flex flex-col`} style={{ ...(rotStyle ?? {}), ...safeVars } as React.CSSProperties} data-rotated={rotated ? '1' : undefined}>
          {hudHidden ? (
            /* 숨김 상태 — 상단 가운데 작은 손잡이만 남는다(실수로 눌리지 않게 작고 반투명) */
            <button onClick={() => toggleHud(false)} aria-label="상단 바 보이기" title="상단 바 보이기"
              className="absolute left-1/2 -translate-x-1/2 z-30 h-6 w-16 rounded-b-xl bg-black/35 backdrop-blur-md border-x border-b border-white/10 text-white/70 hover:text-white hover:bg-black/55 transition-colors flex items-center justify-center"
              style={{ top: 'var(--vbx-safe-top, 0px)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg>
            </button>
          ) : (
            <PlayHeader genreLabel={genreLabel} genreColor={genreColor} title={game.title} gameId={game.id} onClose={close} paused={paused} onTogglePause={togglePause} rotated={rotated} onToggleRotate={() => setRotated(v => !v)} live={screenLive} onToggleLive={!isGuest && !spectate ? toggleScreenLive : undefined} onHide={() => toggleHud(true)} onSave={saveNow} saveState={saveState} />
          )}
          <div className="relative flex flex-row flex-1 min-h-0">
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {!hudHidden && <TransportBar key={game.id} gameId={game.id} active={open} locked={liveLocked} />}
              {/* 게임은 항상 화면 전체(카메라·홈바 뒤까지) — 헤더는 그 위에 겹친다. 게임엔 topInset(헤더 아래 y) 을 알려 AI PLAYING 배지·HUD 를 헤더 밑에 두게 한다 */}
              <div className="absolute inset-0">
              {warp && (
                <div className={`teleport-warp teleport-${warp}`} aria-hidden>
                  <span className="teleport-ring" /><span className="teleport-ring" style={{ animationDelay: '.3s' }} /><span className="teleport-ring" style={{ animationDelay: '.6s' }} />
                  <span className="teleport-flash" />
                  {warp !== 'in' && <span className="teleport-text">{warp === 'out' ? `TELEPORT ▶ ${pending?.title ?? ''}` : 'TELEPORTING…'}</span>}
                </div>
              )}
              {spectate && liveEntry ? (
                /* 관전 — 방을 연 회원의 게임 화면. 다른 회원은 직접 플레이할 수 없다 */
                <div className="absolute inset-0 bg-black">
                  {/* 게임 화면 방송이 있으면 그것을, 없으면 방송하는 회원의 카메라 라이브를 가운데에 크게 */}
                  <CameraBjView key={liveEntry.screen ? 'screen' : 'cam'} hostId={liveEntry.hostId} channel={liveEntry.screen ? 'screen' : 'cam'} fit="contain" badge={false} controls controlsClass="left-3 top-[calc(3.6rem+var(--vbx-safe-top,0px))]" />
                  {/* 게스트(아바타 자리 없음)는 방송자 얼굴을 우측 하단 작은 창으로 — 로그인 회원은 BJ(아바타) 자리에 나온다 */}
                  {isGuest && liveEntry.screen && liveEntry.cam && (
                    <div className="absolute right-3 bottom-[76px] md:bottom-4 w-[104px] md:w-[150px] aspect-[3/4] rounded-2xl overflow-hidden border border-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] z-10">
                      <CameraBjView hostId={liveEntry.hostId} channel="cam" badge sound={false} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: 'calc(3.6rem + var(--vbx-safe-top, 0px))' }}>
                    <span className="rounded-full bg-black/55 backdrop-blur px-3 py-1 text-[12px] font-semibold text-white flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#e11d48] animate-pulse" />{liveEntry.screen ? `${liveEntry.hostName} 님의 플레이를 보는 중 — 관전 모드` : `${liveEntry.hostName} 님의 라이브를 보는 중`}</span>
                  </div>
                </div>
              ) : [game, ...(pending ? [pending] : [])].map((g) => {
                const isPending = pending?.id === g.id && g.id !== game.id
                // 저장 슬롯을 고르기 전에는 게임을 불러오지 않는다(고른 슬롯으로 한 번에 시작)
                if (g.id === game.id && !slotChoice) return null
                return (
                  <iframe
                    key={g.id === game.id ? `${g.id}:${slotChoice}:${restartNonce}` : g.id}
                    src={srcFor(g)}
                    className={`absolute inset-0 w-full h-full border-0 ${isPending ? 'opacity-0 pointer-events-none' : warp === 'out' ? 'teleport-out' : warp === 'hold' ? 'opacity-0' : warp === 'in' ? 'teleport-in' : ''}`}
                    allow="fullscreen; autoplay"
                    title={g.title}
                    style={IOS_IFRAME_FIT}
                    ref={el => { if (!isPending) frameRef.current = el }}
                    onLoad={e => { if (isPending) pendingLoaded.current = true; try { e.currentTarget.contentWindow?.postMessage(hostMsg(), '*'); if (captureCleanup.current) e.currentTarget.contentWindow?.postMessage({ type: 'vibrex:capture', on: true, ...capOpts() }, '*') } catch { /* */ } }}
                    onError={(e) => { const f = e.currentTarget; if (f.src !== g.play_url) f.src = g.play_url }}
                  />
                )
              })}
              {/* 저장 슬롯 — 시작할 때 이어하기/처음부터 고르기, 💾 로 여는 슬롯 패널 */}
              {!spectate && slots && !slotChoice && <SlotChooser slots={slots} onPick={pickStart} />}
              {!spectate && slotPanel && slots && (
                <SlotPanel slots={slots} current={curSlotView} busy={saveState === 'saving'} message={slotMsg}
                  onSave={saveToSlot} onDelete={n => void deleteSlot(n)} onRestart={restartFresh} onClose={() => setSlotPanel(false)} />
              )}
              {/* 모바일: 하단 AJ 위젯 영역이 게임과 딱 나뉘지 않게 — 게임 위로 검정이 서서히 내려오는 그라데이션 */}
              <div className="md:hidden absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />
            </div>
            </div>
            {isGuest ? (
              <>
                {/* 게스트 — 데스크톱 사이드 안내 패널 */}
                <div className="hidden md:flex w-72 shrink-0 flex-col items-center justify-center gap-4 border-l border-[#ebe4d6] bg-[#fcfaf5] h-full px-6 text-center">
                  <span className="text-4xl" aria-hidden>🔒</span>
                  <p className="text-sm text-[#4a4337] font-semibold leading-relaxed">
                    AI 스트리머 AJ의 라이브 방송과<br />채팅은 로그인 후 볼 수 있어요
                  </p>
                  <Link href="/login" className="font-pixel text-[11px] bg-[#2563eb] text-white px-6 py-3 hover:bg-[#1d4ed8] transition-colors tracking-widest">
                    → 로그인하기
                  </Link>
                </div>
                {/* 게스트 — 모바일 하단 안내 바 */}
                <div style={{ paddingBottom: 'calc(0.75rem + var(--vbx-safe-bottom, 0px))' }} className="md:hidden absolute bottom-0 inset-x-0 bg-[#fcfaf5]/95 backdrop-blur-sm border-t border-[#ebe4d6] px-4 pt-3 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#4a4337] font-medium">🔒 AJ 방송·채팅은 로그인 후 이용 가능</span>
                  <Link href="/login" className="shrink-0 text-[13px] font-bold text-[#2563eb]">로그인</Link>
                </div>
              </>
            ) : (
              <AiBjPanel gameId={game.id} genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} bjAvatarConfig={bjAvatarConfig} myAvatarConfig={myAvatarConfig} bjName={bjName} bjLive={bjLive} showHostCam={!!(spectate && liveEntry?.screen && liveEntry?.cam)} />
            )}
          </div>
          </div>
        </div>
      )}
    </>
  )
}
