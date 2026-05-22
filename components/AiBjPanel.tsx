'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

// Pre-seeded audience rows (front=bottom, small=far)
const AUDIENCE_ROWS = [
  { count: 12, size: 10, gap: 3 },
  { count: 16, size: 8,  gap: 2 },
  { count: 21, size: 7,  gap: 1.5 },
  { count: 27, size: 6,  gap: 1 },
  { count: 32, size: 5,  gap: 0.5 },
]
const HEAD_COLORS = ['#ff6935','#f4831f','#f72585','#4361ee','#4cc9f0','#7b2d8b','#fb8500','#3a86ff']
const GLOW_COLORS = ['#ff6935','#f72585','#4cc9f0','#7fff00','#fb8500','#4361ee']
const STAGE_COLORS = ['#ff6935','#f72585','#4cc9f0','#00ff41','#fb8500','#4361ee','#f4831f','#7b2d8b']
function seededColor(r: number, i: number) {
  return HEAD_COLORS[(r * 7 + i * 3 + r) % HEAD_COLORS.length]
}
function seededDelay(r: number, i: number) {
  return ((r * 11 + i * 7) % 23) * 0.08
}
function seededBob(r: number, i: number) {
  return (r * 5 + i * 4) % 3 !== 2
}
function seededGlow(r: number, i: number) {
  return (r * 5 + i * 7) % 4 === 0
}

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

export default function AiBjPanel({ genre, gameTitle, gameDescription, agentConfig }: Props) {
  const persona = AJ_PERSONAS[genre]
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [floatingMsg, setFloatingMsg] = useState<{ text: string; key: number } | null>(null)

  const [charState, setCharState] = useState<'walk' | 'die' | 'eject'>('walk')

  const isStreamingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])
  const prevStreaming = useRef(false)
  const commentaryIdx = useRef(0)
  const yardCharRef = useRef<HTMLDivElement>(null)
  const walkPosRef = useRef(10)
  const walkDirRef = useRef(1)


  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Walk animation (RAF-based, no re-renders)
  useEffect(() => {
    let animId: number
    const walk = () => {
      // Mobile single character
      const el = yardCharRef.current
      if (el && charState === 'walk') {
        const maxPos = (el.parentElement?.offsetWidth ?? 320) - 44
        walkPosRef.current += walkDirRef.current * 0.7
        if (walkPosRef.current >= maxPos) { walkPosRef.current = maxPos; walkDirRef.current = -1 }
        if (walkPosRef.current <= 8) { walkPosRef.current = 8; walkDirRef.current = 1 }
        el.style.transform = `translateX(${walkPosRef.current}px) scaleX(${walkDirRef.current})`
      }
      animId = requestAnimationFrame(walk)
    }
    animId = requestAnimationFrame(walk)
    return () => cancelAnimationFrame(animId)
  }, [charState])

  // Always scroll to bottom — instant during streaming, smooth otherwise
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' })
  }, [messages, isStreaming])

  // Floating message + death trigger
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && !mobileOpen) {
      const last = messagesRef.current[messagesRef.current.length - 1]
      if (last?.role === 'assistant' && last.content) {
        setFloatingMsg({ text: last.content, key: Date.now() })
        const deathWords = ['죽', '게임오버', 'game over', '실패', '졌', '탈락', '아웃', '넘어', '떨어', '충돌', '끝났']
        const isDead = deathWords.some(w => last.content.toLowerCase().includes(w))
        if (isDead && charState === 'walk') {
          setCharState('die')
          setTimeout(() => setCharState('eject'), 650)
          setTimeout(() => {
            walkPosRef.current = 10
            walkDirRef.current = 1
            setCharState('walk')
          }, 1300)
        }
      }
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, mobileOpen, charState])

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
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + chunk }
          return u
        })
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
                <span className="text-[10px]">🤖</span>
              )}
            </div>
          )}
          <div className={`max-w-[85%] text-xs px-2.5 py-1.5 rounded leading-relaxed ${
            msg.role === 'user'
              ? msg.source === 'agent'
                ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                : 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20'
              : 'bg-gray-800 text-gray-200'
          }`}>
            {msg.source === 'agent' && (
              <p className="font-pixel text-[8px] text-purple-400 mb-0.5">{msg.agentName}</p>
            )}
            {msg.content}
            {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
              <span className="inline-block w-1.5 h-3 bg-[#00ff41] ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )

  const inputBar = (
    <div className="px-3 py-2 border-t border-gray-800 shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
          placeholder="AJ에게 말걸기..."
          disabled={isStreaming}
          className="flex-1 bg-gray-900 border border-gray-700 text-white text-xs px-2.5 py-2 placeholder-gray-600 focus:outline-none focus:border-[#00ff41] disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isStreaming || !input.trim()}
          className="font-pixel text-[9px] px-3 py-2 bg-[#00ff41] text-black hover:bg-[#00cc33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >▶</button>
      </div>
    </div>
  )

  const streamingDots = isStreaming && (
    <span className="flex gap-0.5 ml-auto">
      {[0,1,2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-[#00ff41] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )

  return (
    <>
      {/* ─── Desktop: side panel ─── */}
      <div className="hidden md:flex w-72 shrink-0 flex-col border-l border-gray-800 bg-[#0a0a0a] h-full">
        <div className="px-3 py-2 border-b border-gray-800 shrink-0 flex items-center gap-2">
          <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">💬 LIVE CHAT</span>
          {streamingDots}
        </div>
        {messageList}
        {inputBar}

        {/* ─── Desktop: audience stadium ─── */}
        <div className="relative overflow-hidden shrink-0 border-t border-gray-800/40" style={{ height: '134px', background: 'linear-gradient(to bottom, #030509 0%, #070710 50%, #0a0a0a 100%)' }}>
          {/* Colored light beams from stage */}
          <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: '64px', zIndex: 1 }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: '56px', height: '60px', background: 'radial-gradient(ellipse at top, rgba(0,255,65,0.22) 0%, transparent 70%)' }} />
            {([
              { pos: { left: '17%' }, color: 'rgba(255,105,53,0.55)', skew: '-11deg' },
              { pos: { left: '30%' }, color: 'rgba(247,37,133,0.45)', skew: '-5deg' },
              { pos: { right: '17%' }, color: 'rgba(67,97,238,0.55)', skew: '11deg' },
              { pos: { right: '30%' }, color: 'rgba(76,201,240,0.45)', skew: '5deg' },
            ] as { pos: Record<string,string>; color: string; skew: string }[]).map((beam, b) => (
              <div key={b} className="absolute top-0" style={{
                ...beam.pos,
                width: '5px',
                height: '54px',
                background: `linear-gradient(to bottom, ${beam.color} 0%, transparent 100%)`,
                transform: `skewX(${beam.skew})`,
              }} />
            ))}
          </div>
          {/* Stage: LED screens + AJ */}
          <div className="absolute top-0 left-0 right-0 flex items-end justify-center gap-3 px-4" style={{ height: '30px', zIndex: 2 }}>
            <div className="flex flex-col gap-px" style={{ animation: 'stageFlicker 4.5s ease-in-out infinite' }}>
              {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="flex gap-px">
                  {Array.from({ length: 4 }, (_, col) => (
                    <div key={col} style={{ width: 3, height: 3, backgroundColor: STAGE_COLORS[(row * 4 + col) % STAGE_COLORS.length] }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center" style={{ marginBottom: '1px' }}>
              <div className={`rounded-full border overflow-hidden ${persona.borderColor}`} style={{ width: 20, height: 20, animation: 'stageFlicker 3s ease-in-out infinite' }}>
                <Image src="/aibot.png" alt={persona.name} width={20} height={20} className="w-full h-full object-cover" unoptimized />
              </div>
              <span className="font-pixel text-[5px] text-[#00ff41]">{persona.name}</span>
            </div>
            <div className="flex flex-col gap-px" style={{ animation: 'stageFlicker 4.5s ease-in-out infinite', animationDelay: '0.7s' }}>
              {Array.from({ length: 3 }, (_, row) => (
                <div key={row} className="flex gap-px">
                  {Array.from({ length: 4 }, (_, col) => (
                    <div key={col} style={{ width: 3, height: 3, backgroundColor: STAGE_COLORS[(row * 4 + col + 3) % STAGE_COLORS.length] }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Stage floor */}
          <div className="absolute left-0 right-0" style={{ top: '30px', height: '1px', zIndex: 2, background: 'linear-gradient(to right, transparent, rgba(0,255,65,0.7) 20%, rgba(0,255,65,0.7) 80%, transparent)' }} />
          {/* Audience rows — bottom=front large, top=back small */}
          <div className="absolute left-0 right-0 flex flex-col-reverse" style={{ bottom: 0, top: '32px', padding: '2px 3px 1px', gap: '1px' }}>
            {AUDIENCE_ROWS.map((row, r) => (
              <div key={r} className="flex justify-center" style={{ gap: `${row.gap}px`, opacity: 1 - r * 0.09 }}>
                {Array.from({ length: row.count }, (_, i) => {
                  const hasGlow = seededGlow(r, i)
                  const glowColor = GLOW_COLORS[(r * 3 + i * 5) % GLOW_COLORS.length]
                  const headColor = seededColor(r, i)
                  return (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      flexShrink: 0,
                      animation: seededBob(r, i) ? `audienceBob ${0.75 + ((r * 11 + i * 7) % 4) * 0.12}s ease-in-out infinite` : undefined,
                      animationDelay: `${seededDelay(r, i)}s`,
                    }}>
                      {hasGlow && (
                        <div style={{
                          width: 2,
                          height: Math.max(4, Math.round(row.size * 0.65)),
                          backgroundColor: glowColor,
                          borderRadius: '1px 1px 0 0',
                          marginBottom: '1px',
                          animation: `glowStick ${1.1 + ((r + i) % 5) * 0.25}s ease-in-out infinite`,
                          animationDelay: `${seededDelay(r, i) * 1.5}s`,
                          boxShadow: `0 0 3px ${glowColor}`,
                        }} />
                      )}
                      <div style={{ width: row.size, height: row.size, backgroundColor: headColor, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ width: Math.round(row.size * 1.35), height: Math.max(3, Math.round(row.size * 0.5)), backgroundColor: headColor + 'aa', borderRadius: '35% 35% 8% 8%', marginTop: '0.5px', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {/* Floor */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(0,255,65,0.12)' }} />
        </div>

        <div className={`px-3 py-3 border-t border-gray-800 shrink-0 border-l-2 ${persona.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full border-2 ${persona.borderColor} overflow-hidden shrink-0`}>
              <Image src="/aibot.png" alt={persona.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-pixel text-[10px] text-white">{persona.name}</span>
                <span className="flex items-center gap-0.5 text-[9px] text-red-500 font-pixel">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">{persona.catchphrase}</p>
              {agentConfig && (
                <p className="text-[9px] text-purple-400 font-pixel mt-0.5">🤖 {agentConfig.name} 참전</p>
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
            className="bg-black/75 backdrop-blur-sm border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
            }}
          >
            <span className="font-pixel text-[9px] text-[#00ff41]">{persona.name}</span>
            <p className="mt-0.5 leading-relaxed line-clamp-2">{floatingMsg.text}</p>
          </div>
        </div>
      )}

      {/* ─── Mobile: bottom sheet ─── */}
      <div className="md:hidden pointer-events-none">
        {mobileOpen && (
          <div className="absolute inset-0 z-10 bg-black/40 pointer-events-auto" onClick={() => setMobileOpen(false)} />
        )}
        <div className="absolute left-0 right-0 bottom-0 z-20 flex flex-col pointer-events-auto" style={{ transform: 'translateZ(0)' }}>
          <div
            className="flex flex-col bg-[#0a0a0a] border-t border-gray-800 overflow-hidden transition-all duration-300 ease-out"
            style={{ height: mobileOpen ? '52vh' : '0px' }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">💬 LIVE CHAT</span>
                {streamingDots}
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-500 text-lg leading-none px-1">✕</button>
            </div>
            {messageList}
            {inputBar}
          </div>
          {/* ─── Character yard ─── */}
          <div className="relative h-11 overflow-hidden bg-[#060606] pointer-events-none shrink-0">
            <div className="absolute inset-0 flex items-start pt-1.5 px-3 gap-5 opacity-20 pointer-events-none">
              {[0,1,2,3,4,5,6,7,8].map(i => (
                <span key={i} className="text-[8px] text-gray-400 shrink-0" style={{ marginTop: `${(i * 11) % 10}px` }}>·</span>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#0d0d0d]" />
            <div className="absolute bottom-3 left-0 right-0 h-px bg-[#00ff41]/10" />
            <div
              ref={yardCharRef}
              className="absolute bottom-3"
              style={{ transform: 'translateX(10px) scaleX(1)', willChange: 'transform', transformOrigin: 'center bottom' }}
            >
              <div style={{
                animation: charState === 'walk' ? 'charBounce 0.38s ease-in-out infinite'
                  : charState === 'die' ? 'charDie 0.6s ease-in forwards'
                  : 'charEject 0.5s ease-in forwards',
              }}>
                <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-800/60">
                  <Image
                    src={agentConfig?.avatarUrl || '/aibot.png'}
                    alt="character"
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(v => !v)}
            className={`flex items-center gap-3 w-full px-4 py-3 bg-[#0d0d0d] border-t-2 ${persona.borderColor} active:brightness-125 transition-all`}
          >
            <div className={`w-8 h-8 rounded-full border-2 ${persona.borderColor} overflow-hidden shrink-0`}>
              <Image src="/aibot.png" alt={persona.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-pixel text-[11px] text-white">{persona.name}</span>
                <span className="flex items-center gap-1 text-[9px] text-red-400 font-pixel">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
                {isStreaming && !mobileOpen && streamingDots}
              </div>
              <span className="text-[10px] text-gray-500 truncate">
                {agentConfig ? `🤖 ${agentConfig.name} 참전 중` : persona.catchphrase}
              </span>
            </div>
            <div className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 border font-pixel text-[10px] ${
              mobileOpen ? 'border-gray-600 text-gray-400' : 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10'
            }`}>
              {mobileOpen ? '▼ 닫기' : '💬 채팅하기'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
