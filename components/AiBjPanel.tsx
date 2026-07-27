'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'
import type { AvatarConfig } from '@/lib/avatar/config'

const AvatarOverlay = dynamic(() => import('./AvatarOverlay'), { ssr: false })
const CustomBjOverlay = dynamic(() => import('@/lib/avatar/companion/CustomBjOverlay'), { ssr: false })


interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: 'user' | 'agent'
  agentName?: string
}

interface AgentConfig {
  name: string
  persona: string
  avatarUrl?: string
}

interface Props {
  genre: Genre
  gameTitle: string
  gameDescription?: string | null
  agentConfig?: AgentConfig | null
  // 게임 제작자의 저장된 아바타 — 있으면 BJ 3D 아바타로 사용(없으면 기본 AvatarOverlay)
  bjAvatarConfig?: AvatarConfig | null
  // 게임 제작자의 공개 표시명(에이전트 이름) — 하단 BJ 프로필에 AJ 페르소나 대신 노출
  bjName?: string | null
}

const AUTO_COMMENTARY = [
  '지금 이 순간 게임에서 어떤 일이 벌어지고 있는지 게임 요소를 구체적으로 언급하며 한 문장 중계해줘.',
  '플레이어가 지금 어떤 도전을 하고 있을지 게임 메카닉 기반으로 한 문장 방송해줘.',
  '게임에 나오는 적, 장애물, 아이템 중 하나를 언급하며 현재 상황을 외쳐줘.',
  '플레이어가 방금 어떤 행동을 했을지 게임 규칙 기반으로 추측해서 반응해줘.',
  '이 게임의 핵심 승부처! 지금 가장 중요한 게임 요소를 짧게 해설해줘.',
  '점수, 체력, 스테이지 같은 게임 상태를 언급하며 현재 중계해줘.',
  '플레이어가 잘하고 있는지 못하고 있는지 게임 맥락에 맞게 짧게 외쳐줘.',
]

export default function AiBjPanel({ genre, gameTitle, gameDescription, agentConfig, bjAvatarConfig, bjName }: Props) {
  const persona = AJ_PERSONAS[genre]
  const bjAvatar = bjAvatarConfig ? <CustomBjOverlay config={bjAvatarConfig} /> : <AvatarOverlay />
  // 하단 BJ 프로필 — 제작자 에이전트 이름 + 아바타(없으면 AJ 페르소나 fallback)
  const bjLabel = bjName?.trim() || persona.name
  const bjPic = bjAvatarConfig?.previewUrl ?? null
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [floatingMsg, setFloatingMsg] = useState<{ text: string; key: number } | null>(null)

  // 아바타를 데스크탑/모바일 한 곳에만 마운트하기 위한 뷰포트 감지
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  const isStreamingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])
  const prevStreaming = useRef(false)
  const commentaryIdx = useRef(0)

  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Always scroll to bottom — instant during streaming, smooth otherwise
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' })
  }, [messages, isStreaming])

  // Floating message (mobile)
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && !mobileOpen) {
      const last = messagesRef.current[messagesRef.current.length - 1]
      if (last?.role === 'assistant' && last.content) {
        setFloatingMsg({ text: last.content, key: Date.now() })
      }
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, mobileOpen])

  // Core AJ stream function
  const streamAj = useCallback(async (
    prompt: string,
    addAsUserMsg: boolean,
    isAuto = false,
    agentName?: string,
  ) => {
    if (isStreamingRef.current) return

    const history = messagesRef.current
      .slice(-8)
      .filter(m => m.content.trim().length > 0)
      .map(m => ({ role: m.role, content: m.content }))

    if (addAsUserMsg) {
      setMessages(prev => [...prev, {
        role: 'user',
        content: prompt,
        source: agentName ? 'agent' : 'user',
        agentName,
      }])
    }

    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/ai-bj/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          gameTitle,
          gameDescription,
          message: prompt,
          history,
          isAutoCommentary: isAuto,
        }),
      })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + chunk }
          return u
        })
      }
      if (fullText.trim()) {
        window.dispatchEvent(new CustomEvent('avatar:speak', { detail: { text: fullText.trim() } }))
      }
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { ...u[u.length - 1], content: '잠깐 끊겼어! 다시 해볼게 💫' }
        return u
      })
    } finally {
      setIsStreaming(false)
    }
  }, [genre, gameTitle])

  // Agent turn: generate agent message → AJ responds
  const runAgentTurn = useCallback(async () => {
    if (!agentConfig || isStreamingRef.current) return

    try {
      const res = await fetch('/api/user-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: agentConfig.name,
          agentPersona: agentConfig.persona,
          gameTitle,
          genre,
          history: messagesRef.current.slice(-4).filter(m => m.content.trim().length > 0).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let agentMsg = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        agentMsg += decoder.decode(value)
      }
      if (agentMsg.trim()) {
        await streamAj(agentMsg.trim(), true, false, agentConfig.name)
      }
    } catch {
      // silent fail
    }
  }, [agentConfig, gameTitle, genre, streamAj])

  // Timers: intro at 1s, commentary every 10s, agent every 18s
  useEffect(() => {
    const introPrompt = `"${gameTitle}" 게임 방송 시작!! 귀엽고 신나게 인사하면서 이 게임의 핵심 게임 방식을 설명해줘. ${gameDescription ? `게임 설명: ${gameDescription}` : '제목에서 유추해서 알려줘.'} 2문장 이내로!`
    const t1 = setTimeout(() => streamAj(introPrompt, false, false), 1000)

    const t2 = setInterval(() => {
      const prompt = `"${gameTitle}" ${AUTO_COMMENTARY[commentaryIdx.current % AUTO_COMMENTARY.length]}`
      commentaryIdx.current++
      streamAj(prompt, false, true)
    }, 20000)

    const t3 = agentConfig
      ? setInterval(() => runAgentTurn(), 18000)
      : null

    return () => {
      clearTimeout(t1)
      clearInterval(t2)
      if (t3) clearInterval(t3)
    }
  }, [streamAj, runAgentTurn, gameTitle, agentConfig])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setInput('')
    await streamAj(text, true)
  }

  // ── Shared UI pieces ──
  const messageList = (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && (
            <div className={`w-5 h-5 shrink-0 rounded-full border ${persona.borderColor} overflow-hidden mt-0.5`}>
              <Image src="/aibot.png" alt={persona.name} width={20} height={20} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          {msg.source === 'agent' && (
            <div className="w-5 h-5 shrink-0 rounded-full border border-purple-700/50 overflow-hidden mt-0.5 bg-gray-900 flex items-center justify-center">
              {agentConfig?.avatarUrl ? (
                <Image src={agentConfig.avatarUrl} alt={msg.agentName ?? ''} width={20} height={20} className="w-full h-full object-cover" unoptimized />
              ) : (
                <span className="text-[11px]">🤖</span>
              )}
            </div>
          )}
          <div className={`max-w-[85%] text-xs px-2.5 py-1.5 rounded leading-relaxed ${
            msg.role === 'user'
              ? msg.source === 'agent'
                ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                : 'bg-[#0e7573]/10 text-[#0e7573] border border-[#0e7573]/20'
              : 'bg-gray-800 text-[#3a332a]'
          }`}>
            {msg.source === 'agent' && (
              <p className="font-pixel text-[10px] text-purple-400 mb-0.5">{msg.agentName}</p>
            )}
            {msg.content}
            {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
              <span className="inline-block w-1.5 h-3 bg-[#0e7573] ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )

  const inputBar = (
    <div className="px-3 py-2 border-t border-[#e8dfcf] shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
          placeholder="AJ에게 말걸기..."
          disabled={isStreaming}
          className="flex-1 bg-gray-900 border border-[#d9cdb4] text-[#241f17] text-xs px-2.5 py-2 placeholder-[#a1957f] focus:outline-none focus:border-[#0e7573] disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isStreaming || !input.trim()}
          className="font-pixel text-[11px] px-3 py-2 bg-[#0e7573] text-white hover:bg-[#0a5d5b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >▶</button>
      </div>
    </div>
  )

  const streamingDots = isStreaming && (
    <span className="flex gap-0.5 ml-auto">
      {[0,1,2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-[#0e7573] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )

  return (
    <>
      {/* ─── Desktop: side panel ─── */}
      <div className="hidden md:flex w-72 shrink-0 flex-col border-l border-[#e8dfcf] bg-[#f7f2e9] h-full">
        <div className="px-3 py-2 border-b border-[#e8dfcf] shrink-0 flex items-center gap-2">
          <span className="font-pixel text-[11px] text-[#0e7573] tracking-widest">💬 LIVE CHAT</span>
          {streamingDots}
        </div>
        {messageList}
        {inputBar}

        {/* ─── Desktop: 3D AJ avatar ─── */}
        <div className="shrink-0 border-t border-[#e8dfcf]/40 bg-[#050508]" style={{ height: '220px' }}>
          {!isMobile && bjAvatar}
        </div>

        <div className={`px-3 py-3 border-t border-[#e8dfcf] shrink-0 border-l-2 ${persona.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full border-2 ${persona.borderColor} overflow-hidden shrink-0`}>
              <Image src={bjPic ?? '/aibot.png'} alt={bjLabel} width={40} height={40} className={`w-full h-full object-cover ${bjPic ? 'object-top' : ''}`} unoptimized />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-pixel text-[11px] text-[#241f17] truncate">{bjLabel}</span>
                <span className="flex items-center gap-0.5 text-[11px] text-red-500 font-pixel">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-[#6b6152] truncate">{persona.catchphrase}</p>
              {agentConfig && (
                <p className="text-[11px] text-purple-400 font-pixel mt-0.5">🤖 {agentConfig.name} 참전</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile: floating message ─── */}
      {floatingMsg && !mobileOpen && (
        <div
          key={floatingMsg.key}
          className="md:hidden absolute left-3 right-3 z-10 pointer-events-none"
          style={{ bottom: '60px', animation: 'floatUpFade 3.8s ease-out forwards' }}
          onAnimationEnd={() => setFloatingMsg(null)}
        >
          <div
            className="bg-black/75 backdrop-blur-sm border border-[#d9cdb4] rounded px-3 py-2 text-xs text-[#3a332a] overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
            }}
          >
            <span className="font-pixel text-[11px] text-[#0e7573]">{persona.name}</span>
            <p className="mt-0.5 leading-relaxed line-clamp-2">{floatingMsg.text}</p>
          </div>
        </div>
      )}

      {/* ─── Mobile: bottom sheet ─── */}
      <div className="md:hidden pointer-events-none">
        {/* Mobile: 3D AJ avatar, bottom-right */}
        {isMobile && (
          <div
            className="absolute right-2 z-10 overflow-hidden rounded-lg border border-[#e8dfcf] bg-[#050508] pointer-events-none"
            style={{ bottom: '72px', width: 116, height: 150 }}
          >
            {isMobile && bjAvatar}
          </div>
        )}
        {mobileOpen && (
          <div className="absolute inset-0 z-10 bg-black/40 pointer-events-auto" onClick={() => setMobileOpen(false)} />
        )}
        <div className="absolute left-0 right-0 bottom-0 z-20 flex flex-col pointer-events-auto" style={{ transform: 'translateZ(0)' }}>
          <div
            className="flex flex-col bg-[#f7f2e9] border-t border-[#e8dfcf] overflow-hidden transition-all duration-300 ease-out"
            style={{ height: mobileOpen ? '52vh' : '0px' }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#e8dfcf] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[11px] text-[#0e7573] tracking-widest">💬 LIVE CHAT</span>
                {streamingDots}
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-[#857a68] text-lg leading-none px-1">✕</button>
            </div>
            {messageList}
            {inputBar}
          </div>

          <button
            onClick={() => setMobileOpen(v => !v)}
            className={`flex items-center gap-3 w-full px-4 py-3 bg-[#fffdf8] border-t-2 ${persona.borderColor} active:brightness-125 transition-all`}
          >
            <div className={`w-8 h-8 rounded-full border-2 ${persona.borderColor} overflow-hidden shrink-0`}>
              <Image src={bjPic ?? '/aibot.png'} alt={bjLabel} width={32} height={32} className={`w-full h-full object-cover ${bjPic ? 'object-top' : ''}`} unoptimized />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-pixel text-[11px] text-[#241f17] truncate">{bjLabel}</span>
                <span className="flex items-center gap-1 text-[11px] text-red-400 font-pixel">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
                {isStreaming && !mobileOpen && streamingDots}
              </div>
              <span className="text-[11px] text-[#857a68] truncate">
                {agentConfig ? `🤖 ${agentConfig.name} 참전 중` : persona.catchphrase}
              </span>
            </div>
            <div className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 border font-pixel text-[11px] ${
              mobileOpen ? 'border-[#cfc2a6] text-[#6b6152]' : 'border-[#0e7573] text-[#0e7573] bg-[#0e7573]/10'
            }`}>
              {mobileOpen ? '▼ 닫기' : '💬 채팅하기'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
