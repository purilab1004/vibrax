'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  genre: Genre
  gameTitle: string
}

// Auto-commentary prompts — pick randomly for variety
const COMMENTARY_PROMPTS = [
  '지금 게임에서 긴장감 넘치는 상황이 펼쳐지고 있어. 짧은 중계 한 문장.',
  '게임 플레이 중 인상적인 순간을 포착한 것처럼 해설해줘. 한 문장.',
  '지금 게임 상황을 스포츠 중계처럼 짧게 외쳐줘. 한 문장.',
  '플레이어가 뭔가 도전적인 구간을 지나고 있어. 응원 메시지 한 문장.',
  '게임의 핵심 메커닉에 대해 짧게 해설해줘. 한 문장.',
]

export default function AiBjPanel({ genre, gameTitle }: Props) {
  const persona = AJ_PERSONAS[genre]
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [floatingMsg, setFloatingMsg] = useState<{ text: string; key: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isStreamingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])
  const prevStreaming = useRef(false)

  // Keep refs in sync for use inside intervals/callbacks
  useEffect(() => { isStreamingRef.current = isStreaming }, [isStreaming])
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Floating message on mobile when chat is closed
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && !mobileOpen) {
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && last.content) {
        setFloatingMsg({ text: last.content, key: Date.now() })
      }
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, mobileOpen, messages])

  // Core stream function — reused by both user messages and auto-commentary
  const streamResponse = useCallback(async (prompt: string, includeInHistory: boolean) => {
    if (isStreamingRef.current) return

    const history = messagesRef.current.slice(-8)
    if (includeInHistory) {
      setMessages(prev => [...prev, { role: 'user', content: prompt }])
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
          message: prompt,
          history: includeInHistory ? history : history,
        }),
      })
      if (!res.ok || !res.body) throw new Error('API error')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '잠시 연결이 끊겼어. 다시 말해줘!',
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [genre, gameTitle])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setInput('')
    await streamResponse(text, true)
  }

  // Auto-commentary: intro at 3s, then every 28s
  useEffect(() => {
    const introPrompt = `"${gameTitle}" 게임 방송을 시작해줘. 이 게임이 어떤 장르이고 어떻게 하는 게임인지 파악해서 시청자들에게 소개해줘. 2문장 이내로 짧게.`

    const introTimer = setTimeout(() => {
      streamResponse(introPrompt, false)
    }, 3000)

    const interval = setInterval(() => {
      const randomPrompt = `"${gameTitle}" 게임 중이야. ${COMMENTARY_PROMPTS[Math.floor(Math.random() * COMMENTARY_PROMPTS.length)]}`
      streamResponse(randomPrompt, false)
    }, 28000)

    return () => {
      clearTimeout(introTimer)
      clearInterval(interval)
    }
  }, [streamResponse, gameTitle])

  const messageList = (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && (
            <div className={`w-5 h-5 shrink-0 rounded-full border ${persona.borderColor} overflow-hidden mt-0.5`}>
              <Image src="/aibot.png" alt={persona.name} width={20} height={20} className="w-full h-full object-cover" unoptimized />
            </div>
          )}
          <div className={`max-w-[85%] text-xs px-2.5 py-1.5 rounded leading-relaxed ${
            msg.role === 'user'
              ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20'
              : 'bg-gray-800 text-gray-200'
          }`}>
            {msg.content}
            {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
              <span className="inline-block w-1.5 h-3 bg-[#00ff41] ml-0.5 animate-pulse" />
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
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
        >
          ▶
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ─── Desktop: side panel ─── */}
      <div className="hidden md:flex w-72 shrink-0 flex-col border-l border-gray-800 bg-[#0a0a0a] h-full">
        <div className="px-3 py-2 border-b border-gray-800 shrink-0 flex items-center gap-2">
          <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">💬 LIVE CHAT</span>
          {isStreaming && (
            <span className="flex gap-0.5 ml-auto">
              {[0,1,2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-[#00ff41] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          )}
        </div>
        {messageList}
        {inputBar}
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
          <div
            className="absolute inset-0 z-10 bg-black/40 pointer-events-auto"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className="absolute left-0 right-0 bottom-0 z-20 flex flex-col pointer-events-auto"
          style={{ transform: 'translateZ(0)' }}
        >
          {/* Slide-up sheet */}
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
                {isStreaming && (
                  <span className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-[#00ff41] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-500 text-lg leading-none px-1">✕</button>
            </div>
            {messageList}
            {inputBar}
          </div>

          {/* Toggle bar */}
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
                {isStreaming && !mobileOpen && (
                  <span className="flex gap-0.5 ml-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-[#00ff41] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-500 truncate">{persona.catchphrase}</span>
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
