'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'
import type { AvatarConfig } from '@/lib/jeumto/config'
const LiveView = dynamic(() => import('@/components/CameraBjView').then((m) => m.LiveView), { ssr: false })
import type { LiveInfo } from '@/lib/broadcast'

const JeumtoBjOverlay = dynamic(() => import('@/lib/jeumto/JeumtoBjOverlay'), { ssr: false })


interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: 'user' | 'agent'
  agentName?: string
  ts?: number   // 표시 시각 — 시간이 지나면 위에서부터 서서히 사라진다
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
  // 게임 제작자의 저장된 점토 아바타 — 없으면 기본 점토 얼굴
  bjAvatarConfig?: AvatarConfig | null
  // 게임 제작자의 공개 표시명(에이전트 이름) — 하단 BJ 프로필에 AJ 페르소나 대신 노출
  bjName?: string | null
  // 지금 이 게임을 추천 게임으로 방송 중인 라이브(카메라/링크) — 있으면 아바타 대신 표시
  bjLive?: LiveInfo | null
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

export default function AiBjPanel({ genre, gameTitle, gameDescription, agentConfig, bjAvatarConfig, bjName, bjLive }: Props) {
  const persona = AJ_PERSONAS[genre]
  // 제작자가 라이브 방송(ON AIR)을 켜 두었으면 아바타 대신 영상이 BJ 자리에 나온다 (아바타 TTS 는 꺼짐)
  const camera = bjLive ?? null
  const bjAvatar = camera ? <LiveView live={camera} /> : <JeumtoBjOverlay config={bjAvatarConfig ?? null} />
  // 하단 BJ 프로필 — 제작자 에이전트 이름 + 아바타(없으면 AJ 페르소나 fallback)
  const bjLabel = bjName?.trim() || persona.name
  const bjPic = bjAvatarConfig?.previewUrl ?? null
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [floatingMsg, setFloatingMsg] = useState<{ text: string; key: number } | null>(null)
  // 아바타는 말할 때만 보이고, 말이 끝나면 서서히 사라진다 (카메라 방송이면 항상 표시)
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const h = (e: Event) => { const on = (e as CustomEvent<{ on: boolean }>).detail?.on; if (t) clearTimeout(t); if (on) setSpeaking(true); else t = setTimeout(() => setSpeaking(false), 1500) }
    window.addEventListener('avatar:speaking', h)
    return () => { window.removeEventListener('avatar:speaking', h); if (t) clearTimeout(t) }
  }, [])
  // 아바타 게임 참여 — 스냅샷을 게임 iframe 에 postMessage, 무대의 아바타는 게임 속으로 빨려 들어가듯 사라진다. 복귀 가능.
  const [joined, setJoined] = useState(false)
  const [canJoin, setCanJoin] = useState(false)
  const gameFrame = () => Array.from(document.querySelectorAll('iframe')).find(f => { try { return new URL(f.src, location.href).pathname.startsWith('/play/') } catch { return false } }) ?? null
  useEffect(() => { const t = setTimeout(() => setCanJoin(!camera && !!gameFrame()), 800); return () => clearTimeout(t) }, [camera])
  useEffect(() => {
    const onSnap = (e: Event) => { const image = (e as CustomEvent<{ image: string }>).detail?.image; const f = gameFrame(); if (!image || !f?.contentWindow) return; f.contentWindow.postMessage({ type: 'vibrex:avatar', image, name: bjLabel }, '*'); setJoined(true) }
    window.addEventListener('avatar:snapshot', onSnap)
    return () => window.removeEventListener('avatar:snapshot', onSnap)
  }, [bjLabel])
  const joinGame = () => window.dispatchEvent(new CustomEvent('avatar:snapshot-request'))
  const leaveGame = () => { gameFrame()?.contentWindow?.postMessage({ type: 'vibrex:avatar-remove' }, '*'); setJoined(false) }
  const avatarVisible = (!!camera || speaking) && !joined
  // PC 채팅 접기 — 게임 버튼을 가릴 때 왼쪽으로 밀어 넣는다 (기억)
  const [chatOpen, setChatOpen] = useState(() => { try { return localStorage.getItem('aj-chat-open') !== '0' } catch { return true } })
  const toggleChat = () => setChatOpen(v => { try { localStorage.setItem('aj-chat-open', v ? '0' : '1') } catch { /* ignore */ } return !v })
  // 접힌 동안 새로 올라온 메시지 수 — 펼치면 0
  const [seenCount, setSeenCount] = useState(0)
  const unread = chatOpen ? 0 : Math.max(0, messages.length - seenCount)
  useEffect(() => { if (chatOpen) { const t = setTimeout(() => setSeenCount(messages.length), 0); return () => clearTimeout(t) } }, [messages.length, chatOpen])
  // 채팅 시간 경과 페이드 — 1초마다 갱신 (표시 후 CHAT_HOLD 동안 유지 → CHAT_FADE 동안 서서히 사라짐)
  const CHAT_HOLD = 14_000, CHAT_FADE = 8_000
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  const ageOpacity = (ts?: number) => { if (!ts) return 1; const a = now - ts; if (a < CHAT_HOLD) return 1; return Math.max(0, 1 - (a - CHAT_HOLD) / CHAT_FADE) }
  // PC: 아바타 드래그로 위치 이동 (오프셋은 브라우저에 기억)
  const [drag, setDrag] = useState<{ x: number; y: number }>(() => { try { const v = JSON.parse(localStorage.getItem('aj-avatar-pos') ?? 'null'); return v && typeof v.x === 'number' ? v : { x: 0, y: 0 } } catch { return { x: 0, y: 0 } } })
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const onDragStart = (e: React.PointerEvent) => { if (e.button !== 0) return; dragRef.current = { sx: e.clientX, sy: e.clientY, ox: drag.x, oy: drag.y, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const onDragMove = (e: React.PointerEvent) => { const d = dragRef.current; if (!d) return; const nx = d.ox + e.clientX - d.sx, ny = d.oy + e.clientY - d.sy; d.moved = true; setDrag({ x: Math.max(-(window.innerWidth - 220), Math.min(0, nx)), y: Math.max(-(window.innerHeight - 300), Math.min(0, ny)) }) }
  const onDragEnd = () => { const d = dragRef.current; dragRef.current = null; if (d?.moved) { try { localStorage.setItem('aj-avatar-pos', JSON.stringify({ x: Math.min(0, d.ox), y: Math.min(0, d.oy) })) } catch { /* ignore */ } } }
  useEffect(() => { try { localStorage.setItem('aj-avatar-pos', JSON.stringify(drag)) } catch { /* ignore */ } }, [drag])

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
        ts: Date.now(),
      }])
    }

    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', ts: Date.now() }])

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
            <div className="w-5 h-5 shrink-0 rounded-full border border-purple-300 overflow-hidden mt-0.5 bg-white flex items-center justify-center">
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
                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                : 'bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20'
              : 'bg-white text-[#3a332a] border border-[#ebe4d6]'
          }`}>
            {msg.source === 'agent' && (
              <p className="font-pixel text-[10px] text-purple-500 mb-0.5">{msg.agentName}</p>
            )}
            {msg.content}
            {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
              <span className="inline-block w-1.5 h-3 bg-[#2563eb] ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )

  const inputBar = (
    <div className="px-3 py-2 border-t border-[#ebe4d6] shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
          placeholder="AJ에게 말걸기..."
          disabled={isStreaming}
          className="flex-1 bg-white border border-[#ddd3bf] text-[#241f17] text-xs px-2.5 py-2 placeholder-[#a1957f] focus:outline-none focus:border-[#2563eb] disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isStreaming || !input.trim()}
          className="font-pixel text-[11px] px-3 py-2 bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >▶</button>
      </div>
    </div>
  )

  const streamingDots = isStreaming && (
    <span className="flex gap-0.5 ml-auto">
      {[0,1,2].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-[#2563eb] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )

  return (
    <>
      {/* ─── Desktop: 게임 위 오버레이 채팅 — 스트리밍 스타일, 위로 갈수록 자연스럽게 사라진다 ─── */}
      <div className="hidden md:block absolute inset-0 pointer-events-none z-10">
        {/* 좌하단 메시지 스택 (+ 입력) — 접으면 왼쪽으로 슬라이드 */}
        <div className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: chatOpen ? 'translateX(0)' : 'translateX(-400px)' }}>
        <div className="chat-fade absolute left-4 bottom-[74px] w-[360px] max-h-[58%] flex flex-col justify-end overflow-hidden">
          <div className="space-y-1.5">
            {messages.slice(-14).map((msg, i, arr) => (
              <div key={i} className="flex items-start gap-2 transition-opacity duration-1000" style={{ opacity: ageOpacity(msg.ts) }}>
                <div className="max-w-full text-[13px] leading-relaxed px-3 py-1.5 rounded-2xl text-white shadow-[0_1px_4px_rgba(0,0,0,0.4)] bg-black/85">
                  <span className={`font-bold mr-1.5 ${
                    msg.role === 'assistant' ? 'text-sky-300' : msg.source === 'agent' ? 'text-purple-300' : 'text-[#7ef0ff]'
                  }`}>
                    {msg.role === 'assistant' ? persona.name : msg.source === 'agent' ? (msg.agentName ?? 'AGENT') : agentConfig?.name ?? 'ME'}
                  </span>
                  {msg.content}
                  {msg.role === 'assistant' && isStreaming && i === arr.length - 1 && (
                    <span className="inline-block w-1.5 h-3 bg-sky-300 ml-1 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
        {/* 좌하단 입력 바 — 유리 알약 */}
        <div className="absolute left-4 bottom-4 w-[360px] pointer-events-auto">
          <div className="flex items-center gap-2 bg-black/55 backdrop-blur-md rounded-full pl-4 pr-1.5 py-1.5 border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
              placeholder="AJ에게 말걸기..."
              disabled={isStreaming}
              className="flex-1 bg-transparent text-white text-[13px] placeholder-white/50 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] text-white flex items-center justify-center shadow-[0_2px_10px_rgba(37,99,235,0.45)] hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0" aria-label="보내기"
            ><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
          </div>
        </div>
        </div>
        {/* 채팅 접기/펼치기 탭 — 입력창 높이에 맞춰 왼쪽 가장자리 */}
        <button onClick={toggleChat} aria-label={chatOpen ? '채팅 접기' : '채팅 펼치기'} title={chatOpen ? '채팅 접기' : '채팅 펼치기'}
          className="pointer-events-auto absolute bottom-[22px] h-8 w-6 rounded-r-md bg-black/55 backdrop-blur-md border border-l-0 border-white/15 text-white/80 hover:text-white hover:bg-black/75 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ left: chatOpen ? 376 : 0 }}>
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform duration-500 ${chatOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          {!chatOpen && unread > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-extrabold flex items-center justify-center shadow-[0_0_0_3px_rgba(239,68,68,0.3)] animate-pulse">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
        {/* 우하단 — AJ 아바타 + 프로필 배지 */}
        <div className="absolute right-4 bottom-4 w-[180px] pointer-events-auto select-none" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}>
          <div className={`aj-stage aj-stage-desk aj-drag ${camera ? 'aj-stage-cam' : ''} ${joined ? 'aj-stage-joined' : avatarVisible ? 'aj-stage-on' : 'aj-stage-off'}`} style={{ height: '200px' }}
            onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} title="드래그해서 위치 이동">
            {!isMobile && bjAvatar}
            {/* 말하는 중 — 머리 우측 위의 "…" 말풍선 (CSS/SVG) */}
            {speaking && !camera && (
              <div className="aj-typing" aria-hidden>
                <svg viewBox="0 0 64 56" className="w-full h-full">
                  <path d="M32 6c14.9 0 26 9 26 20.5S46.9 47 32 47c-2.1 0-4.2-.2-6.2-.5L14 53l2.4-10.8C9.9 38.4 6 32.8 6 26.5 6 15 17.1 6 32 6Z" fill="rgba(10,12,18,0.6)" stroke="#ffffff" strokeWidth="3.5" strokeLinejoin="round" />
                  <circle cx="21" cy="27" r="3.6" fill="#ffffff" className="aj-dot" style={{ animationDelay: '0s' }} />
                  <circle cx="32" cy="27" r="3.6" fill="#ffffff" className="aj-dot" style={{ animationDelay: '.18s' }} />
                  <circle cx="43" cy="27" r="3.6" fill="#ffffff" className="aj-dot" style={{ animationDelay: '.36s' }} />
                </svg>
              </div>
            )}
          </div>
          <div className="aj-drag relative mt-2 flex items-center gap-2.5 bg-black/60 backdrop-blur-md rounded-full pl-1.5 pr-1.5 py-1.5 border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.45)]" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} title="드래그해서 위치 이동">
            <div className="relative shrink-0">
              <div className="avatar-ring"><div className="avatar-wave w-8 h-8 rounded-full overflow-hidden shrink-0">
                <Image src={bjPic ?? '/aibot.png'} alt={bjLabel} width={32} height={32} className={`w-full h-full object-cover ${bjPic ? 'avatar-bob object-top' : ''}`} unoptimized />
              </div></div>
              {/* 온라인 점 — 라이브 상태 */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#ef4444] ring-2 ring-black/80 shadow-[0_0_0_3px_rgba(239,68,68,0.25)] animate-pulse" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-pixel text-[10px] text-white truncate">{bjLabel}</p>
              <p className="text-[9px] font-bold tracking-[0.14em] text-[#ff6b6b] mt-0.5">LIVE</p>
            </div>
            {canJoin && (
              <button onClick={e => { e.stopPropagation(); joined ? leaveGame() : joinGame() }} onPointerDown={e => e.stopPropagation()}
                className={`h-7 px-3 rounded-full text-[11px] font-bold tracking-wide shrink-0 transition ${joined ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white text-[#111] hover:bg-[#e8f1ff]'}`}>
                {joined ? '복귀' : '게임 참여'}
              </button>
            )}
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
            className="bg-black/75 backdrop-blur-sm border border-[#ddd3bf] rounded px-3 py-2 text-xs text-[#3a332a] overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
            }}
          >
            <span className="font-pixel text-[11px] text-[#2563eb]">{persona.name}</span>
            <p className="mt-0.5 leading-relaxed line-clamp-2">{floatingMsg.text}</p>
          </div>
        </div>
      )}

      {/* ─── Mobile: bottom sheet ─── */}
      <div className="md:hidden pointer-events-none">
        {/* Mobile: 3D AJ avatar, bottom-right */}
        {isMobile && (
          <div
            className={`absolute right-2 z-10 aj-stage ${camera ? 'aj-stage-cam pointer-events-auto' : 'pointer-events-none'} ${avatarVisible ? 'aj-stage-on' : 'aj-stage-off'}`}
            style={camera ? { bottom: '72px', width: 200, height: 112 } : { bottom: '72px', width: 116, height: 150 }}
          >
            {isMobile && bjAvatar}
          </div>
        )}
        {mobileOpen && (
          <div className="absolute inset-0 z-10 bg-black/40 pointer-events-auto" onClick={() => setMobileOpen(false)} />
        )}
        <div className="absolute left-0 right-0 bottom-0 z-20 flex flex-col pointer-events-auto" style={{ transform: 'translateZ(0)' }}>
          <div
            className="flex flex-col bg-[#fcfaf5] border-t border-[#ebe4d6] overflow-hidden transition-all duration-300 ease-out"
            style={{ height: mobileOpen ? '52vh' : '0px' }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#ebe4d6] shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[11px] text-[#2563eb] tracking-widest">💬 LIVE CHAT</span>
                {streamingDots}
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-[#857a68] text-lg leading-none px-1">✕</button>
            </div>
            {messageList}
            {inputBar}
          </div>

          <button
            onClick={() => setMobileOpen(v => !v)}
            className={`flex items-center gap-3 w-full px-4 py-3 bg-[#ffffff] border-t-2 ${persona.borderColor} active:brightness-125 transition-all`}
          >
            <div className="avatar-ring"><div className="avatar-wave w-8 h-8 rounded-full overflow-hidden shrink-0">
              <Image src={bjPic ?? '/aibot.png'} alt={bjLabel} width={32} height={32} className={`w-full h-full object-cover ${bjPic ? 'avatar-bob object-top' : ''}`} unoptimized />
            </div></div>
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
              mobileOpen ? 'border-[#cfc4ab] text-[#6b6152]' : 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/10'
            }`}>
              {mobileOpen ? '▼ 닫기' : '💬 채팅하기'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
