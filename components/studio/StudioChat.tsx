'use client'

import { parseAttach } from '@/lib/studio/attach'
import { useEffect, useRef, useState } from 'react'
import MediaPicker, { type PickedAsset } from '@/components/studio/MediaPicker'
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
  onSend: (prompt: string, images?: { media_type: string; data: string; previewUrl: string }[], sounds?: { name: string; media_type: string; data: string; role: string }[], variantSlug?: string, assetIds?: string[]) => void
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
  const [sounds, setSounds] = useState<{ name: string; media_type: string; data: string; role: string }[]>([])
  // 미디어 라이브러리에서 고른 에셋 — 전송 시 id 만 보낸다 (서버가 게임 HTML 에 주입)
  const [picked, setPicked] = useState<PickedAsset[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const assetIdsRef = useRef<string[]>([])
  const go = (p: string, imgs?: { media_type: string; data: string; previewUrl: string }[], snds?: { name: string; media_type: string; data: string; role: string }[], variantSlug?: string) => onSend(p, imgs, snds, variantSlug, assetIdsRef.current.length ? assetIdsRef.current : undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const soundRef = useRef<HTMLInputElement>(null)
  const addSounds = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 2).forEach(file => {
      if (!file.type.startsWith('audio/')) { alert('오디오 파일만 첨부할 수 있어요 (mp3·wav·ogg).'); return }
      if (file.size > 2 * 1024 * 1024) { alert('사운드는 2MB 이하만 첨부할 수 있어요.'); return }
      const nm = file.name.toLowerCase()
      const role = /bgm|back|music|배경|테마|theme/.test(nm) ? '배경음' : /jump|점프/.test(nm) ? '점프' : /hit|타격|맞|shoot|발사|슛/.test(nm) ? '효과음' : /coin|item|획득|먹/.test(nm) ? '획득' : /over|die|죽|실패/.test(nm) ? '게임오버' : '효과음'
      const reader = new FileReader()
      reader.onload = () => { const b64 = (reader.result as string).split(',')[1]; setSounds(prev => prev.length >= 2 ? prev : [...prev, { name: file.name, media_type: file.type, data: b64, role }]) }
      reader.readAsDataURL(file)
    })
  }

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

  // ── 조작 선택 흐름 — 첫 게임 설명 시, 설계 AI가 장르별 조작안을 제안하면 사용자가 고른다 ──
  type PlanOpt = { id: string; label: string; desc: string; keys: string; variantSlug?: string }
  const [planning, setPlanning] = useState(false)
  const [planData, setPlanData] = useState<{ genre: string; options: PlanOpt[]; pending: { prompt: string; imgs: typeof attachments; snds: typeof sounds } } | null>(null)
  // 이미 조작을 적었으면 제안 단계를 건너뛴다
  const hasControlWords = (p: string) => /(화살표|방향키|스페이스|스페이스바|점프|슬라이드|왼쪽|오른쪽|위아래|wasd|키로|클릭|드래그|마우스|탭으로|터치로|조작(은|을|법|키|방식|은요)|버튼으로|arrow|space|jump)/i.test(p)

  const runPlan = async (prompt: string, imgs: typeof attachments, snds: typeof sounds) => {
    setPlanning(true)
    try {
      const res = await fetch('/api/studio/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await res.json() as { genre?: string; options?: PlanOpt[]; skip?: boolean }
      // skip = 기존 템플릿 매칭(조작 고정) → 조작 카드 없이 바로 생성
      if (!data?.skip && (data?.options?.length ?? 0) >= 2) setPlanData({ genre: data.genre!, options: data.options!, pending: { prompt, imgs, snds } })
      else go(prompt, imgs.length > 0 ? imgs : undefined, snds.length > 0 ? snds : undefined)
    } catch {
      go(prompt, imgs.length > 0 ? imgs : undefined, snds.length > 0 ? snds : undefined)
    } finally {
      setPlanning(false)
    }
  }
  // 조작 카드 선택 → 그 조작을 프롬프트에 붙여 생성 (opt=null 이면 AI 자동)
  const pickControl = (opt: PlanOpt | null) => {
    if (!planData) return
    const { prompt, imgs, snds } = planData.pending
    // 변형 템플릿(variantSlug)이면 프롬프트는 그대로 두고 그 템플릿을 강제. 아니면 조작 설명을 프롬프트에 붙임.
    const augmented = (opt && !opt.variantSlug) ? `${prompt}\n\n[조작 방식] ${opt.label} — ${opt.desc} (키: ${opt.keys})` : prompt
    setPlanData(null)
    go(augmented, imgs.length > 0 ? imgs : undefined, snds.length > 0 ? snds : undefined, opt?.variantSlug)
  }
  // 직접 정하기 → 카드 닫고 원래 설명을 입력창에 되살려 사용자가 이어서 조작을 적게 한다
  const editControls = () => {
    if (!planData) return
    setInput(planData.pending.prompt + ' · 조작: ')
    setPlanData(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = input.trim()
    if (!p || busy || planning || planData) return
    setInput('')
    const imgs = attachments
    const snds = sounds
    setAttachments([]); setSounds([])
    assetIdsRef.current = picked.map(a => a.id); setPicked([])
    // 첫 게임 설명이고 조작을 안 적었으면 → 조작안 제안 단계
    if (messages.length === 0 && !hasControlWords(p)) { runPlan(p, imgs, snds); return }
    go(p, imgs.length > 0 ? imgs : undefined, snds.length > 0 ? snds : undefined)
  }

  return (
    <div className="flex flex-col h-full border-r border-[#ebe4d6]">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 조작안 제안 중 */}
        {messages.length === 0 && !streaming && planning && (
          <div className="pt-16 text-center max-w-md mx-auto">
            <span className="avatar-wave w-14 h-14 rounded-full inline-flex items-center justify-center text-2xl shadow-md overflow-hidden" aria-hidden>{ajAvatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={ajAvatarUrl} alt="" className="w-full h-full object-cover" /> : '🧸'}</span>
            <p className="mt-4 text-[14px] font-semibold text-[#241f17] flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin text-[#2563eb]" fill="none" aria-hidden><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              어울리는 조작 방식을 고르는 중…
            </p>
          </div>
        )}
        {/* 조작안 카드 — 사용자가 선택 */}
        {messages.length === 0 && !streaming && planData && (
          <div className="pt-10 max-w-md mx-auto">
            <p className="text-center text-[13px] text-[#9d9280]"><b className="text-[#2563eb]">{planData.genre}</b> 게임이네요! 조작 방식을 골라주세요</p>
            <div className="mt-4 space-y-2">
              {planData.options.map((o, i) => (
                <button key={o.id} type="button" onClick={() => pickControl(o)} className="w-full text-left rounded-2xl border border-[#ddd3bf] bg-white px-4 py-3 hover:border-[#2563eb] hover:bg-[#f7faff] transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-[#241f17] group-hover:text-[#2563eb]">{o.label}</span>
                    {i === 0 && <span className="text-[10px] font-bold text-[#2563eb] bg-[#2563eb]/10 px-1.5 py-0.5 rounded-full">추천</span>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#6b6152]">{o.desc}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#9d9280]">🎮 {o.keys}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-[12px]">
              <button type="button" onClick={() => pickControl(null)} className="font-semibold text-[#2563eb] hover:underline">그냥 알아서 만들어줘</button>
              <span className="text-[#ddd3bf]">·</span>
              <button type="button" onClick={editControls} className="text-[#9d9280] hover:text-[#4a4337]">직접 정할래요</button>
            </div>
          </div>
        )}
        {messages.length === 0 && !streaming && !planning && !planData && (
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
            {/* 간단 안내 — 조작은 선택(장르 자동) */}
            <div className="mt-4 rounded-2xl border border-[#2563eb]/15 bg-gradient-to-b from-[#eff5ff] to-white px-4 py-3.5 text-left">
              <p className="text-[12.5px] font-bold text-[#241f17] flex items-center gap-1.5">🎮 만들고 싶은 게임을 <b className="text-[#2563eb]">자유롭게</b> 설명하면 돼요</p>
              <p className="text-[11.5px] text-[#6b6152] mt-1.5 leading-relaxed"><b className="text-[#4a4337]">조작 방식은 안 적어도 돼요.</b> 장르에 맞는 익숙한 조작을 자동으로 넣어드려요. <span className="text-[#9d9280]">(러너=점프 · 슈팅=이동+발사 · 퍼즐=방향키)</span></p>
              <p className="text-[11.5px] text-[#9d9280] mt-1.5 leading-relaxed">💡 이기는 <b className="text-[#6b6152]">목표</b>나 <b className="text-[#6b6152]">피할 것</b>을 곁들이면 AI가 더 잘 배워요. <span className="text-[#b3a78f]">(선택)</span></p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === 'user' ? (
            /* 사용자 — 오른쪽, 파랑 그라데이션 말풍선 (오른쪽 아래 모서리만 각지게) */
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-white bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] rounded-2xl rounded-br-md shadow-[0_4px_14px_rgba(37,99,235,0.25)]">
                {(() => { const a = parseAttach(m.content); const imgs = m.images && m.images.length > 0 ? m.images : a.images; return (<>
                  {imgs.length > 0 && (
                    <div className="flex gap-1.5 mb-2">
                      {imgs.map((src, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={src} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-lg ring-1 ring-white/40" />
                      ))}
                    </div>
                  )}
                  {a.sounds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">{a.sounds.map((n, j) => <span key={j} className="text-[11px] bg-white/20 rounded-full px-2 py-0.5">🔊 {n}</span>)}</div>
                  )}
                  {a.text}
                </>) })()}
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
                    {/* 빠르게 진행되는 느낌 — 단계 칩이 착착 체크되고 진행 바가 차오른다 */}
                    {(() => { const PH = ['설계', '렌더링', '조작·물리', '점수·레벨', '모바일', '검수']; const done = Math.min(PH.length, Math.floor(elapsed / 2.2) + (streaming.htmlBytes > 3000 ? 1 : 0)); const pct = Math.min(96, 8 + elapsed * 7 + Math.min(40, streaming.htmlBytes / 400)); return (
                      <div className="px-3 pt-2">
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">{PH.map((ph, i) => <span key={ph} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${i < done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : i === done ? 'border-[#2563eb]/40 bg-[#2563eb]/5 text-[#2563eb] animate-pulse' : 'border-[#e5dcc8] text-[#b3a78f]'}`}>{i < done ? '✓' : i === done ? '●' : '○'} {ph}</span>)}</div>
                        <div className="mt-1.5 h-1 rounded-full bg-[#e5dcc8] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#2563eb] to-[#06b6d4] transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
                      </div>
                    ) })()}
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
          {/* 첨부 사운드 */}
          {sounds.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-1">
              {sounds.map((sd, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-full bg-[#f1ede4] pl-2.5 pr-1.5 py-1 border border-[#e6dfd0]">
                  <span className="text-[13px]">🔊</span>
                  <span className="text-[11.5px] text-[#4a4337] max-w-[120px] truncate">{sd.name}</span>
                  <select value={sd.role} onChange={e => setSounds(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className="text-[10.5px] bg-white border border-[#e6dfd0] rounded px-1 py-0.5 text-[#6b6152]">
                    {['배경음', '점프', '효과음', '획득', '게임오버'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button type="button" onClick={() => setSounds(prev => prev.filter((_, j) => j !== i))} className="w-4 h-4 rounded-full bg-[#241f17] text-white text-[9px] flex items-center justify-center" aria-label="사운드 제거">✕</button>
                </div>
              ))}
            </div>
          )}
          {/* 미디어 라이브러리 에셋 */}
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-1">
              {picked.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-[#eef4ff] pl-1 pr-1.5 py-0.5 border border-[#cfdcff]">
                  {a.kind === 'audio' ? <span className="text-[13px] px-1">🎵</span> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.url} alt="" className="w-6 h-6 rounded object-contain bg-white" />}
                  <span className="text-[11.5px] text-[#1e3a8a] max-w-[120px] truncate">{a.title}</span>
                  <button type="button" onClick={() => setPicked(prev => prev.filter(x => x.id !== a.id))} className="w-4 h-4 rounded-full bg-[#241f17] text-white text-[9px] flex items-center justify-center" aria-label="에셋 제거">✕</button>
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
              {/* 사운드 첨부 */}
              <input ref={soundRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => { addSounds(e.target.files); e.target.value = '' }} />
              <button type="button" onClick={() => soundRef.current?.click()} disabled={sounds.length >= 2}
                title="사운드 첨부 — 배경음·효과음을 넣으면 AI가 게임에 재생 코드를 넣어줘요 (mp3·wav, 2MB)"
                className="w-8 h-8 rounded-full border border-[#ddd3bf] text-[#6b6152] hover:border-[#7c3aed] hover:text-[#7c3aed] flex items-center justify-center transition-colors disabled:opacity-40">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M16 9a5 5 0 0 1 0 6" /></svg>
              </button>
              {/* 미디어 라이브러리 */}
              <button type="button" onClick={() => setPickerOpen(true)} disabled={picked.length >= 10}
                title="미디어 라이브러리 — 캐릭터·배경·아이템 에셋을 골라 게임에 바로 넣어요"
                className="w-8 h-8 rounded-full border border-[#ddd3bf] text-[#6b6152] hover:border-[#0891b2] hover:text-[#0891b2] flex items-center justify-center transition-colors disabled:opacity-40">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></svg>
              </button>
              <p className="text-[11px] text-[#9d9280]">{s.costNote}</p>
            </div>
            <button
              type="submit"
              disabled={busy || planning || !input.trim()}
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
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} picked={picked} onChange={setPicked} />
    </div>
  )
}
