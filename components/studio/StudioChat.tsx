'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n/context'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export default function StudioChat({
  messages, streaming, usage, error, onSend, busy,
}: {
  messages: ChatMsg[]
  streaming: { description: string; htmlBytes: number; codeTail: string } | null
  usage?: { input: number; output: number } | null
  error: string | null
  onSend: (prompt: string) => void
  busy: boolean
}) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const { T } = useLang()
  const s = T.studio

  // 생성 경과 시간 — 초기 단계(모델 연결·구상)에도 시스템이 일하고 있음을 보여준다
  const [elapsed, setElapsed] = useState(0)
  const active = streaming !== null
  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [active])

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
    <div className="flex flex-col h-full border-r border-[#ebe4d6]">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-[#857a68] text-sm pt-8 text-center">
            <p className="mb-2">{s.emptyPreview}</p>
            <p className="text-[11px] text-[#9d9280]">{s.emptyPreviewDesc}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#2563eb]/10 border border-[#2563eb]/40 text-[#241f17]'
                  : 'bg-[#ffffff] border border-[#ebe4d6] text-[#3a332a]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="w-full max-w-[95%] px-3 py-2 text-sm bg-[#ffffff] border border-[#ebe4d6] text-[#3a332a] whitespace-pre-wrap rounded-lg">
              {streaming.description || s.thinking}
              {/* 코드가 오기 전 단계 — 시스템 상태 로그 */}
              {streaming.htmlBytes === 0 && (
                <p className="mt-2 flex items-center gap-2 text-xs text-[#857a68]">
                  <span className="w-3 h-3 border-2 border-[#2563eb]/60 border-t-transparent rounded-full animate-spin" />
                  {elapsed < 3 ? s.sysConnecting : elapsed < 8 ? s.sysPlanning : s.sysDesigning}
                  <span className="text-[#9d9280]">· {s.elapsed(elapsed)}</span>
                </p>
              )}
              {streaming.htmlBytes > 0 && (
                <>
                  {/* 실시간 코드 터미널 — 실제 생성 중인 코드의 꼬리를 흘려보여준다 */}
                  <div className="mt-3 bg-black border border-[#2563eb]/25 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2563eb]/15">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500/80" />
                        <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
                        <span className="w-2 h-2 rounded-full bg-[#2563eb]/80" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-[#857a68]">{s.elapsed(elapsed)} · {s.tokensApprox(Math.round(streaming.htmlBytes / 4).toLocaleString())}</span>
                        <span className="font-pixel text-[10px] text-[#2563eb] tracking-widest animate-pulse">
                          {s.writingCode((streaming.htmlBytes / 1024).toFixed(1))}
                        </span>
                      </span>
                    </div>
                    <pre className="px-3 py-2 h-28 overflow-hidden flex flex-col justify-end font-mono text-[11px] leading-relaxed text-[#2563eb]/70 whitespace-pre-wrap break-all">
                      {streaming.codeTail}
                      <span className="inline-block w-2 h-3.5 bg-[#2563eb] animate-pulse align-text-bottom" />
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* 완료된 마지막 생성의 실제 토큰 사용량 */}
        {!streaming && usage && (
          <p className="text-[11px] text-[#9d9280] text-center">
            {s.usageLine(usage.input.toLocaleString(), usage.output.toLocaleString())}
          </p>
        )}
        {error && (
          <p className="text-red-600 text-xs border border-red-200 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>
      {/* 클로드 스타일 플로팅 입력 카드 — 둥근 카드가 하단에 떠 있고 전송 버튼은 안쪽 우하단 */}
      <form onSubmit={submit} className="px-4 pb-4 pt-1 shrink-0">
        <div className="rounded-2xl bg-white border border-[#ddd3bf] focus-within:border-[#2563eb] shadow-[0_8px_28px_rgba(36,31,23,0.1)] focus-within:shadow-[0_10px_32px_rgba(37,99,235,0.16)] transition-all overflow-hidden">
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
            className="w-full bg-transparent px-4 pt-3.5 pb-1 text-sm text-[#241f17] placeholder-[#a1957f] outline-none resize-none"
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <p className="text-[11px] text-[#9d9280]">{s.costNote}</p>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={s.send}
              className="w-9 h-9 rounded-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
