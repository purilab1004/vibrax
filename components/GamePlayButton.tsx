'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'
import { useLang } from '@/lib/i18n/context'
import AiBjPanel from './AiBjPanel'

const AvatarOverlay = dynamic(() => import('./AvatarOverlay'), { ssr: false })

interface Props {
  game: Game
  genreColor: string
  genreLabel: string
}

interface AgentConfig { name: string; persona: string; avatarUrl?: string }

export default function GamePlayButton({ game, genreColor, genreLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [agentGate, setAgentGate] = useState<'login' | 'agent' | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const { T } = useLang()
  const supabase = createClient()
  const router = useRouter()

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
      <button
        onClick={handlePlay}
        className="shrink-0 font-pixel text-[11px] bg-[#00ff41] text-black px-8 py-4 hover:bg-[#00cc33] transition-colors whitespace-nowrap tracking-widest"
      >
        {T.games.playNow}
      </button>

      {agentGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4" onClick={() => setAgentGate(null)}>
          <div className="w-full max-w-sm bg-[#0a0a0a] border border-purple-700/60" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <span className="font-pixel text-[10px] text-purple-400 tracking-widest">AGENT REQUIRED</span>
              <button onClick={() => setAgentGate(null)} className="text-gray-600 hover:text-white text-lg">✕</button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {agentGate === 'login' ? (
                <>
                  <p className="text-white text-sm font-semibold">로그인이 필요해요</p>
                  <p className="text-gray-400 text-xs leading-relaxed">게임에 참여하려면 로그인 후 나만의 AGENT를 만들어야 해요.</p>
                  <button onClick={() => router.push('/login')} className="w-full font-pixel text-[10px] bg-[#00ff41] text-black py-3 hover:bg-[#00cc33] transition-colors tracking-widest">
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
                  <Link href="/profile" className="block w-full font-pixel text-[10px] bg-purple-700 text-white py-3 hover:bg-purple-600 transition-colors tracking-widest text-center">
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
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
            <div className="flex items-center gap-3">
              <span className={`font-pixel text-[9px] px-2 py-1 text-white ${genreColor}`}>
                {genreLabel}
              </span>
              <span className="text-sm font-medium text-white">{game.title}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] transition-colors px-3 py-1 border border-gray-700 hover:border-[#00ff41]"
            >
              ✕ CLOSE
            </button>
          </div>
          <div className="relative flex flex-row flex-1 min-h-0">
            <div className="relative flex-1 min-h-0 pb-[53px] md:pb-0">
              <iframe
                src={game.play_url}
                className="w-full h-full border-0"
                allow="fullscreen; autoplay"
                title={game.title}
              />
              {/* 3D AJ avatar overlay — bottom-right of game area */}
              <div className="absolute bottom-16 right-3 md:bottom-4 md:right-4 z-10 pointer-events-none" style={{ width: 180, height: 240 }}>
                <AvatarOverlay />
              </div>
            </div>
            <AiBjPanel genre={game.genre} gameTitle={game.title} gameDescription={game.description} agentConfig={agentConfig} />
          </div>
        </div>
      )}
    </>
  )
}
