'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n/context'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export default function StudioChat({
  messages, streaming, error, onSend, busy,
}: {
  messages: ChatMsg[]
  streaming: { description: string; htmlBytes: number } | null
  error: string | null
  onSend: (prompt: string) => void
  busy: boolean
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { T } = useLang()
  const s = T.studio

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streaming?.description, streaming?.htmlBytes])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = input.trim()
    if (!p || busy) return
    setInput('')
    onSend(p)
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-800">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-gray-500 text-sm pt-8 text-center">
            <p className="mb-2">{s.emptyPreview}</p>
            <p className="text-[11px] text-gray-600">{s.emptyPreviewDesc}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#00ff41]/10 border border-[#00ff41]/40 text-white'
                  : 'bg-[#161616] border border-gray-800 text-gray-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-2 text-sm bg-[#161616] border border-gray-800 text-gray-200 whitespace-pre-wrap">
              {streaming.description || s.thinking}
              {streaming.htmlBytes > 0 && (
                <p className="font-pixel text-[11px] text-[#00ff41] mt-2 tracking-widest animate-pulse">
                  {s.writingCode((streaming.htmlBytes / 1024).toFixed(1))}
                </p>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(e)
              }
            }}
            rows={2}
            placeholder={s.chatPlaceholder}
            className="flex-1 bg-[#111] border border-gray-800 focus:border-[#00ff41] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="bg-[#00ff41] text-black font-pixel text-[11px] px-4 hover:bg-[#00cc33] transition-colors disabled:opacity-40 tracking-widest"
          >
            {s.send}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">{s.costNote}</p>
      </form>
    </div>
  )
}
