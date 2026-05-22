'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { BJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  genre: Genre
}

export default function AiBjPanel({ genre }: Props) {
  const persona = BJ_PERSONAS[genre]
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const greetedRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (greetedRef.current) return
    greetedRef.current = true
    setMessages([{ role: 'assistant', content: persona.greeting }])
  }, [persona.greeting])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    const history = messages.slice(-10)
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/ai-bj/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, message: text, history }),
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
  }

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
          placeholder="BJ에게 말걸기..."
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
        <div className="px-3 py-2 border-b border-gray-800 shrink-0">
          <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">💬 LIVE CHAT</span>
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

      {/* ─── Mobile: bottom sheet (fixed over game, outside flex flow) ─── */}
      <div className="md:hidden">
        {/* Backdrop — tap to close */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Bottom sheet + toggle bar */}
        <div
          className="fixed left-0 right-0 bottom-0 z-40 flex flex-col"
          style={{ transform: 'translateZ(0)' }}
        >
          {/* Chat sheet — slides up */}
          <div
            className="flex flex-col bg-[#0a0a0a] border-t border-gray-700 overflow-hidden transition-all duration-300 ease-out"
            style={{ height: mobileOpen ? '52vh' : '0px' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-800 shrink-0">
              <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">💬 LIVE CHAT</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-500 text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>
            {messageList}
            {inputBar}
          </div>

          {/* Always-visible toggle bar */}
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
              </div>
              <span className="text-[10px] text-gray-500 truncate">{persona.catchphrase}</span>
            </div>
            {/* CTA */}
            <div className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 border font-pixel text-[10px] ${
              mobileOpen
                ? 'border-gray-600 text-gray-400'
                : 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10'
            }`}>
              {mobileOpen ? '▼ 닫기' : '💬 채팅하기'}
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
