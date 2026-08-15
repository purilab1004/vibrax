'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import LikeButton from './LikeButton'
import AiBjPanel from './AiBjPanel'
import LiveTitleTicker from './LiveTitleTicker'
import type { AvatarConfig } from '@/lib/jeumto/config'
import { countryFlag } from '@/lib/country'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'
import LOCAL_TEASERS from '@/lib/teasers-local.json'
import { titleFont } from '@/lib/fonts'

const GENRE_LABELS: Record<Game['genre'], string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

// 시청자 아이콘 — 눈(👁) 대신 사람 실루엣
function ViewerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" />
    </svg>
  )
}

const GENRE_COLORS: Record<Game['genre'], string> = {
  action: 'bg-red-700',
  adventure: 'bg-amber-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

// ── 감성 앞면 — 오로라 타이다이 그라디언트 (id로 색 배치 고정) ──
export const PASTELS = ['#3B3B3B', '#E8593F', '#343434', '#3B3B3B', '#E8593F', '#2E2E2E', '#3F3F3F', '#E8593F'] as const

export function hashOf(id: string): number {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return Math.abs(h)
}

// 오로라 배경 — 파랑·핑크·퍼플·시안이 번지는 타이다이 (게임마다 배치가 다르다).
// golden=true(조회수 1위)면 앰버·옐로·오렌지가 번지는 골드 오로라
export function auroraOf(id: string, golden = false): React.CSSProperties {
  const h = hashOf(id)
  const hue = (base: number, spread: number, salt: number) => (base + ((h >> salt) % spread) - spread / 2 + 360) % 360
  const c1 = golden ? hue(42, 10, 3) : hue(322, 36, 3)   // 핑크 → 앰버
  const c2 = golden ? hue(52, 10, 9) : hue(188, 24, 9)   // 시안 → 옐로
  const c3 = golden ? hue(30, 10, 6) : hue(264, 30, 6)   // 퍼플 → 오렌지
  const base = golden ? hue(45, 8, 0) : hue(212, 30, 0)  // 파랑 → 골드
  const sat = golden ? 92 : 78
  const p = (salt: number, min: number, span: number) => min + ((h >> salt) % span)
  return {
    background: [
      `radial-gradient(at ${p(1, 12, 26)}% ${p(2, 8, 22)}%, hsl(${c1} ${sat}% 72%), transparent 52%)`,
      `radial-gradient(at ${p(3, 62, 26)}% ${p(4, 14, 26)}%, hsl(${c2} ${sat}% 70%), transparent 55%)`,
      `radial-gradient(at ${p(5, 16, 26)}% ${p(6, 62, 26)}%, hsl(${c3} ${golden ? 85 : 70}% 62%), transparent 58%)`,
      `radial-gradient(at ${p(7, 60, 28)}% ${p(8, 66, 24)}%, hsl(${c1} ${sat - 4}% 70%), transparent 55%)`,
      `hsl(${base} ${golden ? 80 : 62}% ${golden ? 58 : 56}%)`,
    ].join(', '),
  }
}

// 찰흙 색 팔레트 — 레퍼런스처럼 다양한 클레이 톤 (게임마다 다름)
const CLAY_COLORS = ['#F05A28', '#5AB0F2', '#9B8CE8', '#F2B436', '#4CB97E', '#F2A0C0', '#6ACBE0', '#E8574F'] as const

// hex 밝기 조절 — 클레이 음영용
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, v + amt))
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`
}

// 몸통 형태 — 정사각·기다란 얼굴·넓은 얼굴 등 다양한 비율 (게임마다 다름)
const CLAY_SHAPES = [
  { w: 64, h: 64 },   // 정사각
  { w: 54, h: 80 },   // 기다란 얼굴
  { w: 84, h: 56 },   // 넓은 얼굴
  { w: 60, h: 72 },   // 세로 직사각
  { w: 76, h: 62 },   // 가로 직사각
  { w: 50, h: 66 },   // 갸름한 얼굴
] as const

// 찰흙 캐릭터 — 라운드 3D 사각형 몸통(단색 + 입체 레이어, 그라디언트/ID 미사용) + 작은 점 눈 + 미소
// ※ 홈에서 같은 카드가 모바일/PC 두 벌 렌더되므로 SVG defs id는 충돌한다 — 반드시 id 없는 도형만 사용
function FluffFigure({ delay, eyesRef, color = '#F05A28', shape = 0 }: {
  delay: string
  eyesRef?: React.Ref<SVGGElement>
  color?: string
  shape?: number
}) {
  const { w, h } = CLAY_SHAPES[shape % CLAY_SHAPES.length]
  const cx = 100
  const cy = 94
  const x = cx - w / 2
  const y = cy - h / 2
  const rx = Math.min(w, h) * 0.27
  const eyeGap = Math.min(w * 0.26, 17)
  const eyeY = cy - 2
  return (
    <g className="critter-bob" style={{ animationDelay: delay }}>
      {/* 바닥 그림자 */}
      <ellipse cx={cx} cy={y + h + 7} rx={w * 0.44} ry="5" fill="#000" opacity="0.14" />
      <g className="critter-body" style={{ transformOrigin: `${cx}px ${y + h}px` }}>
        {/* 뒤판 — 어두운 톤을 우하단으로 밀어 3D 두께 */}
        <rect x={x + 5} y={y + 5} width={w} height={h} rx={rx} fill={shade(color, -42)} transform={`rotate(-3 ${cx + 5} ${cy + 5})`} />
        {/* 앞판 — 본색 */}
        <rect x={x} y={y} width={w} height={h} rx={rx} fill={color} transform={`rotate(-3 ${cx} ${cy})`} />
        {/* 앞판 상단 밝은 면 — 클레이 광 */}
        <rect x={x} y={y} width={w} height={h * 0.46} rx={rx} fill={shade(color, 30)} opacity="0.55" transform={`rotate(-3 ${cx} ${cy})`} />
        {/* 정수리 소프트 하이라이트 */}
        <ellipse cx={x + w * 0.26} cy={y + h * 0.17} rx={w * 0.2} ry={h * 0.1} fill="#ffffff" opacity="0.4" transform={`rotate(-16 ${x + w * 0.26} ${y + h * 0.17})`} />
        {/* 작은 검정 눈 — 마우스를 따라 움직인다 */}
        <g ref={eyesRef} className="transition-transform duration-75">
          <circle cx={cx - eyeGap / 2} cy={eyeY} r="2.8" fill="#161616" />
          <circle cx={cx + eyeGap / 2} cy={eyeY} r="2.8" fill="#161616" />
        </g>
        {/* 볼터치 */}
        <circle cx={cx - eyeGap / 2 - 8} cy={eyeY + 9} r="4.2" fill="#ffffff" opacity="0.35" />
        <circle cx={cx + eyeGap / 2 + 8} cy={eyeY + 9} r="4.2" fill="#ffffff" opacity="0.35" />
        {/* 작은 한 줄 커브 미소 */}
        <path d={`M${cx - 3.5} ${eyeY + 9.5}q3.5 3.2 7 0`} stroke="#161616" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
    </g>
  )
}

// 빛 장면 — 오로라 배경 위 하얀 광휘 속 구름 캐릭터.
// 조회수가 많을수록 빛의 범위·세기가 커져 카드 자체가 밝아 보인다.
export function RoomScene({ id, views }: { id: string; views: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const eyesRef = useRef<SVGGElement>(null)

  // 광량 — 0뷰: 은은한 흰 빛, 800뷰+: 최대 밝기.
  // 금빛 물들기는 2000뷰부터 시작해 4000뷰에서 완전한 황금색이 된다
  const t = Math.min(views / 800, 1)
  const tGold = views <= 2000 ? 0 : Math.min((views - 2000) / 2000, 1)
  const glowOpacity = 0.32 + t * 0.58
  const glowR = 58 + t * 54
  const gv = Math.round(255 - tGold * 40)
  const bv = Math.round(255 - tGold * 145)

  // 눈동자 — PC: 마우스 따라, 모바일: 터치 위치 + 스크롤 방향 따라 (rAF 스로틀)
  useEffect(() => {
    let raf = 0
    const lookAt = (clientX: number, clientY: number) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const svg = svgRef.current
        const eyes = eyesRef.current
        if (!svg || !eyes) return
        const r = svg.getBoundingClientRect()
        if (r.width === 0) return
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.5
        const dx = clientX - cx
        const dy = clientY - cy
        const d = Math.hypot(dx, dy) || 1
        const m = Math.min(d / 60, 1) * 4.5
        eyes.style.transform = `translate(${(dx / d) * m}px, ${(dy / d) * m}px)`
      })
    }
    const onMove = (e: MouseEvent) => lookAt(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) lookAt(t.clientX, t.clientY)
    }
    // 스크롤 방향을 따라 위/아래를 본다 — 멈추면 정면으로 복귀
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0
    let decay: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      const eyes = eyesRef.current
      if (!eyes) return
      const dy = window.scrollY - lastY
      lastY = window.scrollY
      const m = Math.max(-4.5, Math.min(4.5, dy * 0.12))
      eyes.style.transform = `translate(0px, ${m}px)`
      if (decay) clearTimeout(decay)
      decay = setTimeout(() => {
        if (eyesRef.current) eyesRef.current.style.transform = 'translate(0px, 0px)'
      }, 260)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      if (decay) clearTimeout(decay)
    }
  }, [])

  return (
    <>
      {/* 광휘 — CSS 라디얼이라 어느 기기에서도 부드럽게 사라진다 (SVG 그라디언트의 모바일 사각 아티팩트 방지) */}
      <div
        className="light-halo absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: `${Math.min(115, glowR * 1.15)}%`,
          aspectRatio: '1 / 1',
          background: `radial-gradient(circle, rgba(255,255,255,${glowOpacity}) 0%, rgba(255,${gv},${bv},${(glowOpacity * 0.55).toFixed(3)}) 45%, rgba(255,${gv},${bv},0) 72%)`,
        }}
        aria-hidden
      />
      <svg ref={svgRef} viewBox="0 0 200 192" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {/* 찰흙 캐릭터 — 게임마다 다른 클레이 색 */}
        {/* 1.35배 확대 — 카드에서 존재감 있게 */}
        <g transform="translate(100 96) scale(1.35) translate(-100 -96)">
          <FluffFigure
            delay={`${(hashOf(id) % 30) / 10}s`}
            eyesRef={eyesRef}
            color={CLAY_COLORS[hashOf(id) % CLAY_COLORS.length]}
            shape={(hashOf(id) >> 4) % 6}
          />
        </g>
      </svg>
    </>
  )
}

interface GameCardProps {
  game: Game
  creatorName?: string | null
  creatorAvatarUrl?: string | null   // 제작자 아바타 프리뷰 PNG (avatar_config.previewUrl)
  creatorCountry?: string | null     // 제작자 국가코드 (ISO alpha-2) → 국기
  bjAvatarConfig?: AvatarConfig | null // 제작자 저장 아바타 — 게임 내 BJ 로 사용
  // 'card' = 썸네일 아래 정보 블록(목록용), 'tile' = 정보를 썸네일 위 오버레이로(홈 모자이크용)
  variant?: 'card' | 'tile'
  // 매소너리(핀터레스트) 배치용 — 타일 비율 오버라이드
  aspectClass?: string
  // 조회수 1위 — 골드 오로라 배경
  golden?: boolean
  // 조회수 랭킹 (1~10만 표시)
  rank?: number
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

// 아케이드 코인 티켓 — 카드에서 코인을 넣으면 10분간 유효, 게임 페이지에서 이중 차감 방지
export const ticketKeyOf = (gameId: string) => `vcoin_ticket_${gameId}`
export function hasCoinTicket(gameId: string): boolean {
  try {
    const t = sessionStorage.getItem(ticketKeyOf(gameId))
    return !!t && Date.now() - Number(t) < 10 * 60 * 1000
  } catch { return false }
}

// 단음 헬퍼 — 짧은 감쇠 엔벨로프
function tone(ctx: AudioContext, type: OscillatorType, freq: number, start: number, dur: number, vol: number) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  o.connect(g)
  g.connect(ctx.destination)
  g.gain.setValueAtTime(vol, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  o.start(start)
  o.stop(start + dur)
}

// 코인 투입 사운드 — 낙하 '톡' → 착지 '찰그랑'(금속성 2연타) → 클래식 코인 징글
export function playCoinSound() {
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    // 낙하 시작 '톡'
    tone(ctx, 'triangle', 740, t + 0.02, 0.06, 0.04)
    // 착지 '찰' — 고음 금속성
    tone(ctx, 'triangle', 3136, t + 0.42, 0.12, 0.1)
    tone(ctx, 'sine', 4699, t + 0.42, 0.08, 0.05)
    // 되튐 '그랑'
    tone(ctx, 'triangle', 2637, t + 0.52, 0.18, 0.08)
    tone(ctx, 'sine', 3951, t + 0.54, 0.12, 0.04)
    // 클래식 코인 징글 (B5 → E6)
    tone(ctx, 'square', 987, t + 0.62, 0.09, 0.06)
    tone(ctx, 'square', 1319, t + 0.7, 0.32, 0.06)
  } catch {}
}

// START 잉걸음 — 상승 아르페지오
export function playStartSound() {
  try {
    const ctx = new AudioContext()
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'square'
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.08
      g.gain.setValueAtTime(0.05, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.frequency.setValueAtTime(f, t)
      o.start(t)
      o.stop(t + 0.15)
    })
  } catch {}
}

// 제작자 아바타 배지 — 동그란 배경 위로 캐릭터(투명 PNG)가 살짝 튀어나와 보이게.
// 이미지를 두 번 그린다: 원 안에 클립된 전체 + 원 밖으로 나가는 위쪽 절반(클립 없음).
function CreatorBadge({ url, name, size }: { url?: string | null; name?: string | null; size: number }) {
  const img = (cls: string) => (
    <Image src={url!} alt={name ?? 'creator'} width={size} height={size} unoptimized
      className={`absolute left-1/2 -translate-x-1/2 bottom-[-6%] w-[124%] h-[124%] max-w-none object-contain object-bottom ${cls}`} />
  )
  return (
    <span className="relative shrink-0 inline-block" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full border-2 border-white/80 bg-white/70 shadow-md overflow-hidden inline-flex items-center justify-center">
        {url ? img('') : (
          <span className="font-pixel text-[13px] text-[#857a68]">{(name ?? '?').charAt(0).toUpperCase()}</span>
        )}
      </span>
      {url && img('[clip-path:inset(0_0_52%_0)]')}
    </span>
  )
}

export default function GameCard({ game, creatorName, creatorAvatarUrl, creatorCountry, bjAvatarConfig, variant = 'card', aspectClass = 'aspect-video', golden = false, rank }: GameCardProps) {
  const flag = countryFlag(creatorCountry)
  const { T, lang } = useLang()
  const [open, setOpen] = useState(false)
  // 호버 말풍선 — 구름처럼 튀어나오는 랜덤 멘트
  const [bubble, setBubble] = useState<string | null>(null)
  // 터치 기기(호버 없음): 첫 탭 = 뽑기 플립, 두 번째 탭 = 플레이
  const [flipped, setFlipped] = useState(false)
  const [touchMode, setTouchMode] = useState(false)
  useEffect(() => {
    setTouchMode(window.matchMedia('(hover: none)').matches)
  }, [])
  // 플레이어를 닫으면 카드도 앞면으로 복귀
  useEffect(() => {
    if (!open) setFlipped(false)
  }, [open])
  // 호버 라이브 미리보기 — 잠깐 스친 마우스에 iframe이 뜨지 않게 지연 후 실행
  const [preview, setPreview] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setPreview(true), 500)
  }
  const stopPreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setPreview(false)
    setPreviewReady(false)
  }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])
  const [agentGate, setAgentGate] = useState<'login' | 'agent' | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // 아케이드 코인 투입 — idle(INSERT COIN) → drop(동전 떨어짐) → ready(PRESS START)
  const [coinState, setCoinState] = useState<'idle' | 'drop' | 'ready'>('idle')

  const insertCoin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (coinState !== 'idle') return
    if (hasCoinTicket(game.id)) { setCoinState('ready'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAgentGate('login'); return }
    setCoinState('drop')
    playCoinSound()
    const { error } = await supabase.rpc('spend_vcoin', { p_game_id: game.id } as never)
    if (error) {
      if (error.message.includes('insufficient_vcoin')) {
        alert(T.games.insufficientCoin)
        setCoinState('idle')
        return
      }
      console.warn('vcoin spend skipped:', error.message)
    }
    try { sessionStorage.setItem(ticketKeyOf(game.id), String(Date.now())) } catch {}
    // 코인이 슬릿에 들어가고 찰그랑 소리가 끝날 때쯤 READY
    setTimeout(() => setCoinState('ready'), 900)
  }

  const startGame = (e: React.MouseEvent) => {
    e.stopPropagation()
    playStartSound()
    setTimeout(() => router.push(`/games/${game.id}`), 250)
  }

  // 모달이 열리면 뒤 홈페이지 스크롤 잠금
  useEffect(() => {
    if (!open && !agentGate) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, agentGate])

  const handlePlay = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAgentGate('login'); return }
    const name = user.user_metadata?.agent_name?.trim()
    if (!name) { setAgentGate('agent'); return }
    // 🪙 코인 투입 — 잔액 부족이면 플레이 불가 (관리자는 서버에서 무료 처리)
    const { error: coinError } = await supabase.rpc('spend_vcoin', { p_game_id: game.id } as never)
    if (coinError) {
      if (coinError.message.includes('insufficient_vcoin')) {
        alert(T.games.insufficientCoin)
        return
      }
      // 마이그레이션 전/일시 오류 — 플레이는 막지 않는다
      console.warn('vcoin spend skipped:', coinError.message)
    }
    const persona = user.user_metadata?.agent_persona?.trim()
    const avatarUrl = user.user_metadata?.agent_avatar_url ?? ''
    setAgentConfig({ name, persona: persona ?? '', avatarUrl })
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          // 타일: 본문 클릭으로는 이동하지 않는다 — 코인 넣기 → START 버튼으로만 진입.
          // (모바일은 첫 탭에 뽑기 플립만)
          if (variant === 'tile') {
            if (touchMode && !flipped) {
              setFlipped(true)
              setBubble(T.games.hoverMsgs[Math.floor(Math.random() * T.games.hoverMsgs.length)])
            }
            return
          }
          handlePlay()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (variant === 'tile') router.push(`/games/${game.id}`)
            else handlePlay()
          }
        }}
        className="group block w-full text-left cursor-pointer"
      >
        {variant === 'tile' ? (
        <div>
          {/* 감성 플립 타일 — 앞면: 파스텔+캐릭터, 호버: 3D 플립으로 실제 썸네일 */}
          <div
            className={`gacha-wrap relative ${flipped ? 'gacha-flipped' : ''}`}
            onMouseEnter={() => {
              setBubble(T.games.hoverMsgs[Math.floor(Math.random() * T.games.hoverMsgs.length)])
            }}
            onMouseLeave={() => setBubble(null)}
          >
            {/* 흔들림 셸 — 호버 판정은 바깥(고정), 흔들림·원근은 여기 */}
            <div className="gacha-shell [perspective:1200px]">
            <div className={`pointer-events-none relative ${aspectClass} w-full transition-transform duration-300 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
              {/* 앞면 — 오로라 배경 + 몽실 태양 + 유혹 질문 (제목은 플립해야 공개) */}
              <div
                className="grain absolute inset-0 rounded-xl overflow-hidden [backface-visibility:hidden] flex flex-col"
                style={auroraOf(game.id, golden)}
              >
                {/* 조회수 랭킹 배지 — 상단 우측 (#1 금 / #2 은 / #3 동) */}
                {rank && rank <= 10 && (
                  <span className={`absolute top-3 right-3 z-10 font-pixel text-[12px] px-2.5 py-1 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${
                    rank === 1 ? 'bg-[#c9940c] text-white' : rank === 2 ? 'bg-gray-300 text-[#241f17]' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-white/85 text-[#241f17]'
                  }`}>
                    #{rank}
                  </span>
                )}
                {/* 유혹 질문 — Jua 포스터 타이틀 (games 카드와 동일 배치) */}
                <div className="absolute inset-x-0 top-[12%] px-4 text-center z-[5]">
                  <h3 className={`${titleFont.className} text-[32px] md:text-[36px] leading-[1.25] text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]`}>
                    {lang === 'en'
                      ? (game.teaser_en || T.games.teasers[hashOf(game.id) % T.games.teasers.length])
                      : (game.teaser || (LOCAL_TEASERS as Record<string, string>)[game.id] || T.games.teasers[hashOf(game.id) % T.games.teasers.length])}
                  </h3>
                </div>
                <div className="absolute inset-x-1 top-[21%] bottom-[16%]">
                  <RoomScene id={game.id} views={game.view_count ?? 0} />
                </div>
                <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
                  <p className="flex items-center gap-2.5 text-[15px] font-bold tracking-[0.06em] text-white/85">
                    <CreatorBadge url={creatorAvatarUrl} name={creatorName} size={32} />
                    <span className="truncate max-w-[45%]">{creatorName ?? 'unknown'}{flag && ` ${flag}`}</span>
                    <span className="text-white/40">·</span>
                    <ViewerIcon className="w-5 h-5" />
                    <span className="text-[16px]">{formatViewers(game.view_count ?? 0)}</span>
                  </p>
                </div>
              </div>
              {/* 뒷면 — 어둡게 깔린 썸네일 + 중앙 큰 PLAY (클릭 시 게임 페이지로 이동) */}
              <div className="absolute inset-0 rounded-xl overflow-hidden bg-gray-900 ring-1 ring-gray-800/60 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <Image src={game.thumbnail_url} alt={game.title} fill className="object-cover" />
                {/* 어두운 오버레이 — 버튼과 텍스트가 주인공 */}
                <div className="absolute inset-0 bg-black/55 pointer-events-none" />
                <span className="absolute left-2 top-2 flex items-center gap-1 bg-red-600/80 text-white font-pixel text-[10px] px-1.5 py-0.5 rounded tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  AJ LIVE
                </span>
                {/* 구름 말풍선 — 위쪽에서 멘트 */}
                {bubble && (
                  <div className="absolute top-[16%] left-1/2 -translate-x-1/2 pointer-events-none z-10">
                    <div className="bubble-pop relative bg-white/95 text-[#241f17] text-[13px] font-bold px-4 py-2 rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.25)] whitespace-nowrap">
                      {bubble}
                      <span className="absolute -bottom-2 left-5 w-3 h-3 bg-white/95 rounded-full" />
                      <span className="absolute -bottom-4 left-2.5 w-2 h-2 bg-white/90 rounded-full" />
                    </div>
                  </div>
                )}
                {/* 아케이드 패널 — 코인 슬롯 + INSERT COIN / PRESS START */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {/* 코인 슬롯 — 투입구 + 상태등 */}
                  <div className="relative w-14 h-[70px]">
                    <div className={`w-full h-full rounded-lg bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-2 transition-shadow ${
                      coinState === 'ready' ? 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.15),0_0_18px_rgba(76,255,106,0.5)]' : ''
                    } ${coinState === 'drop' ? 'slot-clink' : ''}`}>
                      {/* 투입구 슬릿 */}
                      <span className="w-1.5 h-8 rounded-full bg-black shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]" />
                      {/* 상태등 — 대기: 빨강, 준비: 초록 */}
                      <span className={`w-2.5 h-2.5 rounded-full ${coinState === 'ready' ? 'bg-[#4cff6a] shadow-[0_0_8px_#4cff6a]' : 'bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
                    </div>
                    {/* 골드 코인 — 떨어져서 슬릿 안으로 쏙 들어간다 */}
                    {coinState === 'drop' && (
                      <>
                        <span className="gold-coin absolute left-1/2 -top-8" aria-hidden />
                        <span className="slot-spark absolute left-1/2 top-[10px] -translate-x-1/2 text-sm" aria-hidden>✨</span>
                      </>
                    )}
                  </div>

                  {coinState !== 'ready' ? (
                    <>
                      <p className="arcade-blink font-pixel text-[13px] tracking-[0.3em] text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]">
                        INSERT COIN
                      </p>
                      <button
                        onClick={insertCoin}
                        disabled={coinState === 'drop'}
                        className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-b from-[#d9a71b] to-[#b3830a] text-white font-bold text-[14px] px-6 py-2.5 shadow-[0_4px_0_#7d5a06,0_8px_16px_rgba(0,0,0,0.45)] active:translate-y-1 active:shadow-[0_1px_0_#7d5a06] transition-all disabled:opacity-90"
                      >
                        {coinState === 'drop' ? (
                          <>
                            <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none" aria-hidden><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                            코인 투입 중...
                          </>
                        ) : (
                          <>🪙 × {game.coin_cost ?? 1} 코인 넣기</>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="arcade-blink font-pixel text-[13px] tracking-[0.3em] text-[#4cff6a] drop-shadow-[0_0_6px_rgba(76,255,106,0.7)]">
                        PRESS START
                      </p>
                      {/* 빨간 아케이드 돔 버튼 */}
                      <button
                        onClick={startGame}
                        className="pointer-events-auto w-20 h-20 rounded-full bg-gradient-to-b from-[#ff6a52] to-[#d92c1a] text-white font-pixel text-[13px] tracking-widest shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_6px_0_#8f1508,0_12px_22px_rgba(0,0,0,0.55)] active:translate-y-1.5 active:shadow-[inset_0_3px_6px_rgba(255,255,255,0.35),0_2px_0_#8f1508] transition-all"
                      >
                        START
                      </button>
                    </>
                  )}
                </div>
                {/* 정답 공개 — 게임 제목 */}
                <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
                  <h3 className="text-xl font-extrabold text-white truncate leading-tight">{game.title}</h3>
                  <p className="mt-0.5 text-[13px] text-white/70 truncate">
                    {creatorName ?? 'unknown'}{flag && ` ${flag}`}
                  </p>
                </div>
              </div>
            </div>
            </div>

            {/* 뽑기 버스트 — 공개 순간 사방으로 터지는 별 */}
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center" aria-hidden>
              {([
                ['-90px', '-70px', '#f2b436'], ['90px', '-80px', '#2563eb'], ['-100px', '30px', '#06b6d4'],
                ['104px', '40px', '#f472b6'], ['-50px', '-110px', '#4cc97e'], ['56px', '104px', '#f2b436'],
                ['-70px', '90px', '#2563eb'], ['40px', '-104px', '#f472b6'],
              ] as const).map(([dx, dy, c], i) => (
                <span
                  key={i}
                  className="gacha-star absolute text-xl"
                  style={{ '--dx': dx, '--dy': dy, color: c } as React.CSSProperties}
                >
                  ✦
                </span>
              ))}
            </div>
          </div>

        </div>
        ) : (
        <div>
          <div
            className={`relative ${aspectClass} w-full overflow-hidden bg-gray-900 rounded-xl ring-1 ring-gray-800/60`}
            onMouseEnter={startPreview}
            onMouseLeave={stopPreview}
          >
            {/* 채도·밝기 한 단계 다운 → 격자 전체가 차분해지고, 호버 시 원본 색으로 살아남 */}
            <Image
              src={game.thumbnail_url}
              alt={game.title}
              fill
              className="object-cover saturate-[.8] brightness-90 group-hover:saturate-100 group-hover:brightness-100 group-hover:scale-[1.03] transition-all duration-300"
            />
            {/* 호버 라이브 미리보기 — 게임이 실제로 실행됨. 클릭은 카드로 통과(pointer-events-none) */}
            {preview && (
              <iframe
                src={game.play_url}
                tabIndex={-1}
                title={`${game.title} preview`}
                onLoad={() => setPreviewReady(true)}
                className={`absolute inset-0 w-full h-full border-0 pointer-events-none transition-opacity duration-500 ${previewReady ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
            {/* 공통 하단 그라데이션 — 제각각인 썸네일에 통일감 */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            {/* LIVE 배지 — 절제된 크기·투명도 */}
            <span className="absolute left-2 bottom-2 flex items-center gap-1 bg-red-600/80 text-white font-pixel text-[10px] px-1.5 py-0.5 rounded tracking-widest">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              AJ LIVE
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="font-pixel text-[11px] bg-[#2563eb]/90 text-white px-3 py-2 rounded">
                ▶ PLAY
              </span>
            </div>
          </div>
          {/* 정보 블록 — 아바타 + 2줄 제목 + 채널명 + 조회수·장르 (card 변형 전용) */}
          {variant === 'card' && (
          <div className="mt-4 flex items-start gap-3 px-0.5">
            <div className="w-9 h-9 shrink-0 rounded-full border border-[#ebe4d6] overflow-hidden bg-gray-900 flex items-center justify-center">
              {creatorAvatarUrl ? (
                <Image
                  src={creatorAvatarUrl}
                  alt={creatorName ?? 'creator'}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover object-top"
                  unoptimized
                />
              ) : (
                <span className="font-pixel text-[11px] text-[#857a68]">{(creatorName ?? '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-semibold text-gray-100 line-clamp-2 leading-snug">
                {game.title}
              </h3>
              <p className="mt-1 flex items-center gap-1 min-w-0 text-sm text-[#6b6152]">
                <span className="truncate">{creatorName ?? 'unknown'}</span>
                {flag && <span className="text-[13px] leading-none shrink-0" title={creatorCountry ?? ''}>{flag}</span>}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-[#857a68] truncate">
                <ViewerIcon className="w-4 h-4 shrink-0" />
                {formatViewers(game.view_count ?? 0)}
                {' · '}{GENRE_LABELS[game.genre]}
                {game.language && ` · ${game.language === 'ko' ? '한국어' : 'EN'}`}
              </p>
            </div>
            <LikeButton gameId={game.id} size="sm" />
          </div>
          )}
        </div>
        )}
      </div>

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
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe4d6] bg-[#fcfaf5] shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span
                className={`font-pixel text-[11px] px-2 py-1 text-white shrink-0 ${GENRE_COLORS[game.genre]}`}
              >
                {GENRE_LABELS[game.genre]}
              </span>
              <LiveTitleTicker title={game.title} />
            </div>
            <div className="shrink-0 ml-3 bg-white rounded-full px-3 py-1.5 border border-[#ebe4d6]">
              <LikeButton gameId={game.id} size="md" />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="shrink-0 ml-3 font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] transition-colors px-3 py-1 border border-[#ddd3bf] hover:border-[#2563eb]"
            >
              ✕ CLOSE
            </button>
          </div>

          {/* Body: iframe + AI AJ panel */}
          <div className="relative flex flex-row flex-1 min-h-0">
            <div className="flex-1 min-h-0 pb-[53px] md:pb-0">
              <iframe
                src={game.play_url}
                className="w-full h-full border-0"
                allow="fullscreen; autoplay"
                title={game.title}
              />
            </div>
            <AiBjPanel genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} bjAvatarConfig={bjAvatarConfig} bjName={creatorName} />
          </div>
        </div>
      )}
    </>
  )
}
