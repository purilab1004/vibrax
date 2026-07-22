'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import LikeButton from './LikeButton'
import AiBjPanel from './AiBjPanel'
import LiveTitleTicker from './LiveTitleTicker'
import type { AvatarConfig } from '@/lib/avatar/config'
import { countryFlag } from '@/lib/country'
import { formatViewers } from '@/lib/format'

const GENRE_LABELS: Record<Game['genre'], string> = {
  action: 'ACTION',
  adventure: 'ADVENTURE',
  strategy: 'STRATEGY',
  sports: 'SPORTS',
}

const GENRE_COLORS: Record<Game['genre'], string> = {
  action: 'bg-red-700',
  adventure: 'bg-amber-700',
  strategy: 'bg-blue-700',
  sports: 'bg-green-700',
}

interface GameCardProps {
  game: Game
  creatorName?: string | null
  creatorAvatarUrl?: string | null   // 제작자 아바타 프리뷰 PNG (avatar_config.previewUrl)
  creatorCountry?: string | null     // 제작자 국가코드 (ISO alpha-2) → 국기
  bjAvatarConfig?: AvatarConfig | null // 제작자 저장 아바타 — 게임 내 BJ 로 사용
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

export default function GameCard({ game, creatorName, creatorAvatarUrl, creatorCountry, bjAvatarConfig }: GameCardProps) {
  const flag = countryFlag(creatorCountry)
  const [open, setOpen] = useState(false)
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
        <div className="bg-[#111] border border-gray-800 group-hover:border-[#00ff41] transition-all duration-200 overflow-hidden">
          {/* 썸네일 — kick 스트림 카드 문법: LIVE 배지 + 시청자수 오버레이 */}
          <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
            <Image
              src={game.thumbnail_url}
              alt={game.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white font-pixel text-[10px] px-1.5 py-1 tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              AJ LIVE
            </span>
            <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/75 text-gray-100 text-[11px] px-1.5 py-0.5">
              <span className="text-[11px]">👁</span>{formatViewers(game.view_count ?? 0)}
            </span>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="font-pixel text-[11px] bg-[#00ff41]/90 text-black px-3 py-2">
                ▶ PLAY
              </span>
            </div>
          </div>
          {/* 하단 정보 — 제작자 아바타 + 제목/제작자/장르 (kick 스트리머 정보 배치) */}
          <div className="p-3 flex items-start gap-2.5">
            <div className="w-8 h-8 shrink-0 rounded-full border border-gray-700 overflow-hidden bg-gray-900 flex items-center justify-center">
              {creatorAvatarUrl ? (
                <Image
                  src={creatorAvatarUrl}
                  alt={creatorName ?? 'creator'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover object-top"
                  unoptimized
                />
              ) : (
                <span className="font-pixel text-[11px] text-gray-500">{(creatorName ?? '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-gray-100 truncate leading-tight">
                {game.title}
              </h3>
              <p className="mt-1 flex items-center gap-1 min-w-0">
                <span className="text-xs text-gray-400 truncate">{creatorName ?? 'unknown'}</span>
                {flag && <span className="text-[11px] leading-none shrink-0" title={creatorCountry ?? ''}>{flag}</span>}
              </p>
              <p className="mt-0.5 font-pixel text-[10px] text-gray-600 tracking-widest truncate">
                {GENRE_LABELS[game.genre]}
                {game.language && ` · ${game.language === 'ko' ? '한국어' : 'EN'}`}
              </p>
            </div>
            <LikeButton gameId={game.id} size="sm" />
          </div>
        </div>
      </div>

      {agentGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4" onClick={() => setAgentGate(null)}>
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-purple-700/60" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <span className="font-pixel text-[11px] text-purple-400 tracking-widest">AGENT REQUIRED</span>
              <button onClick={() => setAgentGate(null)} className="text-gray-600 hover:text-white text-lg">✕</button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {agentGate === 'login' ? (
                <>
                  <p className="text-white text-sm font-semibold">로그인이 필요해요</p>
                  <p className="text-gray-400 text-xs leading-relaxed">게임에 참여하려면 로그인 후 나만의 AGENT를 만들어야 해요.</p>
                  <button onClick={() => router.push('/login')} className="w-full font-pixel text-[11px] bg-[#00ff41] text-black py-3 hover:bg-[#00cc33] transition-colors tracking-widest">
                    → 로그인하기
                  </button>
                </>
              ) : (
                <>
                  <p className="text-white text-sm font-semibold">AGENT를 먼저 만들어주세요</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    게임 참여는 나만의 AI AGENT가 필요해요.<br />
                    AGENT는 게임 중 AI 스트리머 AJ와 실시간으로 대화하며 방송의 흥을 이어가줘요.
                  </p>
                  <div className="border border-purple-900/40 bg-purple-900/10 px-4 py-3 space-y-1">
                    <p className="text-[11px] text-gray-400">• 이름과 성격을 설정하면 그대로 행동</p>
                    <p className="text-[11px] text-gray-400">• 내가 게임할 동안 AJ와 채팅 대신</p>
                    <p className="text-[11px] text-gray-400">• 프로필 → MY AGENT에서 1분이면 완료</p>
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
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
              className="shrink-0 ml-3 font-pixel text-[11px] text-gray-400 hover:text-[#00ff41] transition-colors px-3 py-1 border border-gray-700 hover:border-[#00ff41]"
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
