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
import type { AvatarConfig } from '@/lib/avatar/config'
import { countryFlag } from '@/lib/country'
import { formatViewers } from '@/lib/format'
import { useLang } from '@/lib/i18n/context'

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

// ── 감성 앞면 — 파스텔 배경 + 움직이는 눈알 캐릭터 (id로 색·패턴 고정) ──
const PASTELS = ['#F6EE8D', '#9FA2F2', '#C9E8F5', '#79C7F2', '#A6E3AE', '#F6C4DC', '#F8D9A2', '#F5978A'] as const

function hashOf(id: string): number {
  let h = 0
  for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) | 0
  return Math.abs(h)
}

// 몸통 색 — 파스텔 배경 위에서 도드라지는 진한 톤 (배경과 같은 해시로 짝지어진다)
const CRITTER_BODIES = ['#5B5F97', '#3E8E7E', '#E2856E', '#4E86B8', '#4E937A', '#C4699B', '#C98A2E', '#B85B4E'] as const

function Critter({ id }: { id: string }) {
  const body = CRITTER_BODIES[hashOf(id) % CRITTER_BODIES.length]
  const delay = `${(hashOf(id) % 30) / 10}s`
  const svgRef = useRef<SVGSVGElement>(null)
  const eyesRef = useRef<SVGGElement>(null)

  // 눈동자가 마우스를 따라간다 — rAF로 스로틀
  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const svg = svgRef.current
        const eyes = eyesRef.current
        if (!svg || !eyes) return
        const r = svg.getBoundingClientRect()
        if (r.width === 0) return
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.45
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const d = Math.hypot(dx, dy) || 1
        const m = Math.min(d / 60, 1) * 6
        eyes.style.transform = `translate(${(dx / d) * m}px, ${(dy / d) * m}px)`
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 200 200" className="w-[50%] max-w-[160px] critter-bob" style={{ animationDelay: delay }} aria-hidden>
      {/* 머리 위 야자수 — 로고와 같은 줄기/잎 5장 */}
      <g className="critter-sprout" style={{ transformOrigin: '100px 55px' }}>
        <path d="M97 55c.9-9 2.6-16 6.9-22" stroke="#8a5a2b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <g fill="none" stroke="#39b36b" strokeWidth="4.8" strokeLinecap="round">
          <path d="M104 33c-7-4.8-14-5.2-19.8-2.2" />
          <path d="M104 33c-2.2-7.4-6.6-12.3-12.3-14.5" />
          <path d="M104 33c3-7 8.3-11 14.5-11.8" />
          <path d="M104 33c7.4-3 14.5-1.7 19.3 2.2" />
          <path d="M104 33c5.7 1.3 10 5.2 12.3 11" />
        </g>
      </g>
      {/* 말랑한 젤리 몸통 — 바닥 기준으로 살짝 눌렸다 펴진다 */}
      <g className="critter-body" style={{ transformOrigin: '100px 158px' }}>
        <path
          d="M100 50c34 0 58 24 59 54 1 32-25 54-59 54s-60-22-59-54c1-30 25-54 59-54Z"
          fill={body}
        />
        {/* 정수리 하이라이트 */}
        <ellipse cx="78" cy="72" rx="14" ry="8" fill="#ffffff" opacity="0.22" transform="rotate(-18 78 72)" />
        {/* 눈 — 흰자 + 마우스를 따라가는 눈동자 */}
        <circle cx="79" cy="96" r="14" fill="#fffdf5" />
        <circle cx="121" cy="96" r="14" fill="#fffdf5" />
        <g ref={eyesRef} className="transition-transform duration-75">
          <circle cx="79" cy="96" r="6.5" fill="#161616" />
          <circle cx="121" cy="96" r="6.5" fill="#161616" />
          <circle cx="81.5" cy="93.5" r="2" fill="#ffffff" />
          <circle cx="123.5" cy="93.5" r="2" fill="#ffffff" />
        </g>
        {/* 볼터치 + 미소 */}
        <circle cx="66" cy="114" r="7" fill="#ff9d9d" opacity="0.55" />
        <circle cx="134" cy="114" r="7" fill="#ff9d9d" opacity="0.55" />
        <path d="M88 118q12 11 24 0" stroke="#161616" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    </svg>
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
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

export default function GameCard({ game, creatorName, creatorAvatarUrl, creatorCountry, bjAvatarConfig, variant = 'card', aspectClass = 'aspect-video' }: GameCardProps) {
  const flag = countryFlag(creatorCountry)
  const { T } = useLang()
  const [open, setOpen] = useState(false)
  // 호버 말풍선 — 구름처럼 튀어나오는 랜덤 멘트
  const [bubble, setBubble] = useState<string | null>(null)
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
        onClick={handlePlay}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePlay() } }}
        className="group block w-full text-left cursor-pointer"
      >
        {variant === 'tile' ? (
          /* 감성 플립 타일 — 앞면: 파스텔+캐릭터+제목+조회수, 호버: 3D 플립으로 실제 썸네일 */
          <div
            className="[perspective:1200px]"
            onMouseEnter={() => {
              startPreview()
              setBubble(T.games.hoverMsgs[Math.floor(Math.random() * T.games.hoverMsgs.length)])
            }}
            onMouseLeave={() => {
              stopPreview()
              setBubble(null)
            }}
          >
            <div className={`relative ${aspectClass} w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]`}>
              {/* 앞면 */}
              <div
                className="absolute inset-0 rounded-xl overflow-hidden [backface-visibility:hidden] flex flex-col"
                style={{ backgroundColor: PASTELS[hashOf(game.id) % PASTELS.length] }}
              >
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <Critter id={game.id} />
                </div>
                <div className="pb-5 px-3 text-center shrink-0">
                  <h3 className="font-bold uppercase tracking-[0.18em] text-[#1d1a14] text-[13px] md:text-[15px] truncate">
                    {game.title}
                  </h3>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] md:text-[12px] tracking-[0.14em] text-[#1d1a14]/60">
                    <ViewerIcon className="w-3.5 h-3.5" />
                    {formatViewers(game.view_count ?? 0)}
                  </p>
                </div>
              </div>
              {/* 뒷면 — 실제 썸네일 + 라이브 미리보기 */}
              <div className="absolute inset-0 rounded-xl overflow-hidden bg-gray-900 ring-1 ring-gray-800/60 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <Image src={game.thumbnail_url} alt={game.title} fill className="object-cover" />
                {preview && (
                  <iframe
                    src={game.play_url}
                    tabIndex={-1}
                    title={`${game.title} preview`}
                    onLoad={() => setPreviewReady(true)}
                    className={`absolute inset-0 w-full h-full border-0 pointer-events-none transition-opacity duration-500 ${previewReady ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                <span className="absolute left-2 top-2 flex items-center gap-1 bg-red-600/80 text-white font-pixel text-[10px] px-1.5 py-0.5 rounded tracking-widest">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  AJ LIVE
                </span>
                {/* 구름 말풍선 — 눌러보고 싶게 하는 랜덤 멘트 */}
                {bubble && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <div className="bubble-pop relative bg-white/95 text-[#241f17] text-[13px] font-bold px-4 py-2 rounded-full shadow-[0_6px_20px_rgba(0,0,0,0.25)] whitespace-nowrap">
                      {bubble}
                      <span className="absolute -bottom-2 left-5 w-3 h-3 bg-white/95 rounded-full" />
                      <span className="absolute -bottom-4 left-2.5 w-2 h-2 bg-white/90 rounded-full" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3 pointer-events-none">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white truncate leading-tight">{game.title}</h3>
                    <p className="mt-0.5 text-[13px] text-white/70 truncate">
                      {creatorName ?? 'unknown'}{flag && ` ${flag}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-pixel text-[11px] bg-[#2563eb]/90 text-white px-3 py-2 rounded">
                    ▶ PLAY
                  </span>
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4" onClick={() => setAgentGate(null)}>
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
          className="fixed inset-0 z-50 flex flex-col bg-black"
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
