'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'
import { loadAvatarConfig } from '@/lib/jeumto/storage'
import { useLiveBroadcasts, liveForGame } from '@/lib/live/useLiveBroadcasts'
import { useGameTelemetry } from '@/lib/aj/telemetry'
import type { AvatarConfig } from '@/lib/jeumto/config'
import AiBjPanel from './AiBjPanel'
import LiveTitleTicker from './LiveTitleTicker'
import LikeButton from './LikeButton'
import { hasCoinTicket, ticketKeyOf } from './GameCard'

interface Props {
  game: Game
  genreColor: string
  genreLabel: string
  bjName?: string | null   // 제작자 공개 표시명(에이전트 이름) — 하단 BJ 프로필용
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

export default function GamePlayButton({ game, genreColor, genreLabel, bjName }: Props) {
  const [open, setOpen] = useState(false)
  useGameTelemetry(game.id, open) // AJ 텔레메트리 — 플레이 세션 기록
  const [agentGate, setAgentGate] = useState<'login' | 'agent' | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [bjAvatarConfig, setBjAvatarConfig] = useState<AvatarConfig | null>(null)
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

  const handlePlay = async () => {
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
    // 게임 제작자의 저장된 아바타를 BJ 로 사용 (없으면 AiBjPanel 이 기본 아바타 fallback)
    loadAvatarConfig(supabase, game.user_id).then(setBjAvatarConfig).catch(() => {})
    setOpen(true)
    supabase.rpc('increment_view_count', { game_id: game.id }).then(() => {})
  }

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
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe4d6] bg-[#fcfaf5] shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className={`font-pixel text-[11px] px-2 py-1 text-white rounded shrink-0 ${genreColor}`}>
                {genreLabel}
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
          <div className="relative flex flex-row flex-1 min-h-0">
            <div className="flex-1 min-h-0 pb-[53px] md:pb-0">
              <iframe
                src={game.play_url}
                className="w-full h-full border-0"
                allow="fullscreen; autoplay"
                title={game.title}
              />
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
              <AiBjPanel genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} bjAvatarConfig={bjAvatarConfig} bjName={bjName} bjLive={liveForGame(liveMap, game.id)} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
