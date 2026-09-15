'use client'

import Link from 'next/link'
import { playSrc } from '@/lib/game-src'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'
import { loadAvatarConfig } from '@/lib/jeumto/storage'
import { useLiveBroadcasts, liveForGame } from '@/lib/live/useLiveBroadcasts'
import { useGameTelemetry } from '@/lib/aj/telemetry'
import type { AvatarConfig } from '@/lib/jeumto/config'
import AiBjPanel from './AiBjPanel'
import PlayHeader from './PlayHeader'
import TransportBar, { type Cand } from './TransportBar'
import { hasCoinTicket, ticketKeyOf } from './GameCard'

const GENRE_LABELS: Record<string, string> = { action: 'ACTION', adventure: 'ADVENTURE', strategy: 'STRATEGY', sports: 'SPORTS' }
const GENRE_COLORS: Record<string, string> = { action: 'bg-red-700', adventure: 'bg-amber-700', strategy: 'bg-blue-700', sports: 'bg-green-700' }

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
  const gameAreaRef = useRef<HTMLDivElement | null>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!open) return
    const el = gameAreaRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; setArea({ w: r.width, h: r.height }) })
    ro.observe(el); return () => ro.disconnect()
  }, [open])
  useEffect(() => { if (open) return; const t = setTimeout(() => setRotated(false), 0); return () => clearTimeout(t) }, [open])
  const rotStyle: React.CSSProperties | undefined = rotated && area.w > 0 ? { width: area.h, height: area.w, top: (area.h - area.w) / 2, left: (area.w - area.h) / 2, transform: 'rotate(90deg)', transformOrigin: 'center', inset: 'auto' } : undefined
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const togglePause = () => { const next = !paused; setPaused(next); try { frameRef.current?.contentWindow?.postMessage({ type: 'vibrex:pause', on: next }, '*') } catch { /* */ } }
  useEffect(() => {
    if (!open) return
    const h = (e: MessageEvent) => { const d = e.data as { type?: string; on?: boolean } | null; if (d && d.type === 'vibrex:paused') setPaused(!!d.on) }
    window.addEventListener('message', h); return () => window.removeEventListener('message', h)
  }, [open])
  useEffect(() => { if (open) return; const t = setTimeout(() => setPaused(false), 0); return () => clearTimeout(t) }, [open])
  useGameTelemetry(game.id, open) // AJ 텔레메트리 — 플레이 세션 기록 (게임이 바뀌면 새 세션)
  const [agentGate, setAgentGate] = useState<'login' | 'agent' | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [bjAvatarConfig, setBjAvatarConfig] = useState<AvatarConfig | null>(null)
  const [myAvatarConfig, setMyAvatarConfig] = useState<AvatarConfig | null>(null)  // 시청자(나)의 아바타 — 무대에 서고 게임에 참여한다
  const liveMap = useLiveBroadcasts()
  const [isGuest, setIsGuest] = useState(false)
  const { T } = useLang()
  const supabase = createClient()
  const router = useRouter()

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
      const { error: coinError } = await supabase.rpc('spend_vcoin', { p_game_id: game.id } as never)
      if (coinError) {
        if (coinError.message.includes('insufficient_vcoin')) {
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
    loadAvatarConfig(supabase, user.id).then(setMyAvatarConfig).catch(() => {})
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

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
        const { error } = await supabase.rpc('spend_vcoin', { p_game_id: c.id } as never)
        return !(error?.message.includes('insufficient_vcoin'))
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
  useEffect(() => {
    if (autoRef.current) return
    let play = false
    try { play = new URLSearchParams(window.location.search).get('play') === '1' } catch { /* */ }
    if (!play) return
    autoRef.current = true
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* */ }
    const t = setTimeout(() => { void handlePlay() }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* 아케이드 START — 카드 뒷면과 같은 빨간 돔 버튼, 큼직하게 */}
      <button
        onClick={handlePlay}
        className="shrink-0 rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[15px] tracking-[0.2em] px-12 py-5 shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_6px_0_#8f1508,0_12px_22px_rgba(0,0,0,0.35)] active:translate-y-1.5 active:shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_2px_0_#8f1508] transition-all whitespace-nowrap"
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
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <PlayHeader genreLabel={genreLabel} genreColor={genreColor} title={game.title} gameId={game.id} onClose={() => setOpen(false)} paused={paused} onTogglePause={togglePause} rotated={rotated} onToggleRotate={() => setRotated(v => !v)} />
          <div className="relative flex flex-row flex-1 min-h-0">
            <div ref={gameAreaRef} className="relative flex-1 min-h-0 overflow-hidden">
              <TransportBar key={game.id} gameId={game.id} active={open} />
              <div className={`absolute inset-0 ${rotated ? "bg-black" : ""}`} style={rotStyle}>
              {warp && (
                <div className={`teleport-warp teleport-${warp}`} aria-hidden>
                  <span className="teleport-ring" /><span className="teleport-ring" style={{ animationDelay: '.3s' }} /><span className="teleport-ring" style={{ animationDelay: '.6s' }} />
                  <span className="teleport-flash" />
                  {warp !== 'in' && <span className="teleport-text">{warp === 'out' ? `TELEPORT ▶ ${pending?.title ?? ''}` : 'TELEPORTING…'}</span>}
                </div>
              )}
              {[game, ...(pending ? [pending] : [])].map((g) => {
                const isPending = pending?.id === g.id && g.id !== game.id
                return (
                  <iframe
                    key={g.id}
                    src={playSrc(g)}
                    className={`absolute inset-0 w-full h-full border-0 ${isPending ? 'opacity-0 pointer-events-none' : warp === 'out' ? 'teleport-out' : warp === 'hold' ? 'opacity-0' : warp === 'in' ? 'teleport-in' : ''}`}
                    allow="fullscreen; autoplay"
                    title={g.title}
                    ref={el => { if (!isPending) frameRef.current = el }}
                    onLoad={e => { if (isPending) pendingLoaded.current = true; try { e.currentTarget.contentWindow?.postMessage({ type: 'vibrex:host', pause: true, bottomInset: window.matchMedia('(max-width: 767px)').matches ? 56 : 0 }, '*') } catch { /* */ } }}
                    onError={(e) => { const f = e.currentTarget; if (f.src !== g.play_url) f.src = g.play_url }}
                  />
                )
              })}
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
                <div className="md:hidden absolute bottom-0 inset-x-0 bg-[#fcfaf5]/95 backdrop-blur-sm border-t border-[#ebe4d6] px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#4a4337] font-medium">🔒 AJ 방송·채팅은 로그인 후 이용 가능</span>
                  <Link href="/login" className="shrink-0 text-[13px] font-bold text-[#2563eb]">로그인</Link>
                </div>
              </>
            ) : (
              <AiBjPanel gameId={game.id} genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} bjAvatarConfig={bjAvatarConfig} myAvatarConfig={myAvatarConfig} bjName={bjName} bjLive={liveForGame(liveMap, game.id)} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
