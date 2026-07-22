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
  streaming: { description: string; htmlBytes: number; codeTail: string } | null
  error: string | null
  onSend: (prompt: string) => void
  busy: boolean
}) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const { T } = useLang()
  const s = T.studio

  // 채팅 컨테이너 내부만 스크롤 — scrollIntoView는 페이지 전체를 끌어내려서 금지
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
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
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
            <div className="w-full max-w-[95%] px-3 py-2 text-sm bg-[#161616] border border-gray-800 text-gray-200 whitespace-pre-wrap rounded-lg">
              {streaming.description || s.thinking}
              {streaming.htmlBytes > 0 && (
                <>
                  {/* 실시간 코드 터미널 — 실제 생성 중인 코드의 꼬리를 흘려보여준다 */}
                  <div className="mt-3 bg-black border border-[#00ff41]/25 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#00ff41]/15">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500/80" />
                        <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
                        <span className="w-2 h-2 rounded-full bg-[#00ff41]/80" />
                      </span>
                      <span className="font-pixel text-[10px] text-[#00ff41] tracking-widest animate-pulse">
                        {s.writingCode((streaming.htmlBytes / 1024).toFixed(1))}
                      </span>
                    </div>
                    <pre className="px-3 py-2 h-28 overflow-hidden flex flex-col justify-end font-mono text-[11px] leading-relaxed text-[#00ff41]/70 whitespace-pre-wrap break-all">
                      {streaming.codeTail}
                      <span className="inline-block w-2 h-3.5 bg-[#00ff41] animate-pulse align-text-bottom" />
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="text-red-400 text-xs border border-red-900 bg-red-900/20 px-3 py-2">
            {error}
          </p>
        )}
      </div>
      <form onSubmit={submit} className="border-t border-gray-800 p-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(e)
            }
          }}
          rows={3}
          placeholder={s.chatPlaceholder}
          className="w-full bg-[#111] border border-gray-800 focus:border-[#00ff41] px-3.5 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none rounded-lg"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-full mt-2 bg-[#00ff41] text-black text-sm font-semibold py-3 rounded-lg hover:bg-[#00cc33] transition-colors disabled:opacity-40"
        >
          {s.send}
        </button>
        <p className="text-[11px] text-gray-600 mt-2">{s.costNote}</p>
      </form>
    </div>
  )
}
