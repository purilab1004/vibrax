'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n/context'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  images?: string[]  // 첨부 이미지 미리보기 URL (낙관적 표시용, 미저장)
}

export default function StudioChat({
  messages, streaming, usage, error, onSend, busy, draft, onDraftConsumed, ajAvatarUrl, ajName, generationCost = 10,
}: {
  messages: ChatMsg[]
  streaming: { description: string; htmlBytes: number; codeTail: string } | null
  usage?: { input: number; output: number; credits?: number; balance?: number } | null
  generationCost?: number
  error: string | null
  onSend: (prompt: string, images?: { media_type: string; data: string; previewUrl: string }[]) => void
  busy: boolean
  /* 외부(학습 노트 '다음 도전')에서 입력창에 채워 넣을 문장 */
  draft?: string | null
  onDraftConsumed?: () => void
  /* AJ 아바타 — 내 점토 캐릭터 프리뷰 (없으면 기본) */
  ajAvatarUrl?: string | null
  ajName?: string | null
}) {
  const [input, setInput] = useState('')
  const [seenDraft, setSeenDraft] = useState<string | null>(null)
  if (draft && draft !== seenDraft) { setSeenDraft(draft); setInput(draft); onDraftConsumed?.() }
  // 첨부 이미지 — 레퍼런스를 보여주면 AI가 보고 만든다 (최대 3장, 각 5MB)
  const [attachments, setAttachments] = useState<{ media_type: string; data: string; previewUrl: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 3).forEach(file => {
      if (!file.type.startsWith('image/')) return
      if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 첨부할 수 있어요.'); return }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        setAttachments(prev => prev.length >= 3 ? prev : [...prev, {
          media_type: file.type,
          data: base64,
          previewUrl: URL.createObjectURL(file),
        }])
      }
      reader.readAsDataURL(file)
    })
  }
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
    const imgs = attachments
    setAttachments([])
    onSend(p, imgs.length > 0 ? imgs : undefined)
  }

  return (
    <div className="flex flex-col h-full border-r border-[#ebe4d6]">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="pt-10 text-center max-w-md mx-auto">
            <span className="avatar-wave w-14 h-14 rounded-full inline-flex items-center justify-center text-2xl shadow-md overflow-hidden" aria-hidden>{ajAvatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ajAvatarUrl} alt="" className="w-full h-full object-cover" /> : '🧸'}</span>
            <p className="mt-3 text-[15px] font-semibold text-[#241f17]">{s.emptyPreview}</p>
            <p className="mt-1 text-[12px] text-[#9d9280]">{s.emptyPreviewDesc}</p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {['테트리스 게임 만들어줘', '벽돌깨기, 배경은 우주로 블록은 과일 모양으로', '장애물 점프하는 공룡 러너', '운석 피하는 우주선 슈팅, 보스 추가'].map((q) => (
                <button key={q} type="button" onClick={() => setInput(q)} className="rounded-xl border border-[#ddd3bf] bg-white px-3.5 py-2.5 text-[13px] text-[#4a4337] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === 'user' ? (
            /* 사용자 — 오른쪽, 파랑 그라데이션 말풍선 (오른쪽 아래 모서리만 각지게) */
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-white bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] rounded-2xl rounded-br-md shadow-[0_4px_14px_rgba(37,99,235,0.25)]">
                {m.images && m.images.length > 0 && (
                  <div className="flex gap-1.5 mb-2">
                    {m.images.map((src, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={j} src={src} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-lg ring-1 ring-white/40" />
                    ))}
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ) : (
            /* AJ — 왼쪽, 아바타 + 이름 + 흰 말풍선 (왼쪽 위 모서리만 각지게) */
            <div key={i} className="flex items-start gap-2.5">
              <span className="avatar-wave w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] shadow-sm overflow-hidden" aria-hidden>{ajAvatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ajAvatarUrl} alt="" className="w-full h-full object-cover" /> : '🧸'}</span>
              <div className="min-w-0 max-w-[85%]">
                <p className="text-[11px] font-semibold text-[#9d9280] mb-1 ml-1">{ajName || 'AJ'}</p>
                <div className="px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-[#241f17] bg-white border border-[#ebe4d6] rounded-2xl rounded-tl-md shadow-[0_2px_10px_rgba(36,31,23,0.05)]">
                  {m.content}
                </div>
              </div>
            </div>
          )
        ))}
        {streaming && (
          <div className="flex items-start gap-2.5">
            <span className="avatar-wave w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] shadow-sm overflow-hidden" aria-hidden>{ajAvatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ajAvatarUrl} alt="" className="w-full h-full object-cover" /> : '🧸'}</span>
            <div className="w-full max-w-[90%] px-4 py-2.5 text-[14px] leading-relaxed bg-white border border-[#ebe4d6] text-[#241f17] whitespace-pre-wrap rounded-2xl rounded-tl-md shadow-[0_2px_10px_rgba(36,31,23,0.05)]">
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
                  {/* 실시간 코드 터미널 — 밝은 배경에 진한 코드로 또렷하게 */}
                  <div className="mt-3 bg-[#f8f5ec] border border-[#ddd3bf] rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e5dcc8] bg-[#f1ecdd]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500/80" />
                        <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
                        <span className="w-2 h-2 rounded-full bg-[#2563eb]/80" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-[#857a68]">{s.elapsed(elapsed)} · 이번 생성 프롬코인 {generationCost}</span>
                        <span className="font-pixel text-[10px] text-[#2563eb] tracking-widest animate-pulse">
                          코드 작성 중… {Math.max(1, Math.round(streaming.htmlBytes / 38)).toLocaleString()}줄
                        </span>
                      </span>
                    </div>
                    <pre className="px-3 py-2 h-28 overflow-hidden flex flex-col justify-end font-mono text-[11.5px] leading-relaxed text-[#1d4ed8] whitespace-pre-wrap break-all">
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
            {usage.credits != null && usage.credits > 0 ? `이번 생성 — 프롬코인 ${usage.credits.toLocaleString()} 사용 · 잔액 ${(usage.balance ?? 0).toLocaleString()}` : `이번 생성 — 프롬코인 차감 없음 · 잔액 ${(usage.balance ?? 0).toLocaleString()}`}
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
          {/* 첨부 이미지 미리보기 */}
          {attachments.length > 0 && (
            <div className="flex gap-2 px-4 pb-1">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.previewUrl} alt="첨부 이미지" className="w-14 h-14 object-cover rounded-lg border border-[#ebe4d6]" />
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#241f17] text-white text-[10px] flex items-center justify-center"
                    aria-label="첨부 제거"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-2">
              {/* 이미지 첨부 */}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={attachments.length >= 3}
                title="이미지 첨부 (레퍼런스를 보여주면 AI가 보고 만들어요)"
                className="w-8 h-8 rounded-full border border-[#ddd3bf] text-[#6b6152] hover:border-[#2563eb] hover:text-[#2563eb] flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-4.5-4.5L9 18" />
                </svg>
              </button>
              <p className="text-[11px] text-[#9d9280]">{s.costNote}</p>
            </div>
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
