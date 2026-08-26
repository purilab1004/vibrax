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
  gameId?: string
  genre: Genre
  gameTitle: string
  gameDescription?: string | null
  agentConfig?: AgentConfig | null
  // 게임 제작자의 저장된 점토 아바타 — 없으면 기본 점토 얼굴
  bjAvatarConfig?: AvatarConfig | null
  // 시청자(나)의 아바타 — 있으면 무대에 내 아바타가 서고, 게임 참여도 내 아바타가 한다
  myAvatarConfig?: AvatarConfig | null
  // 게임 제작자의 공개 표시명(에이전트 이름) — 하단 BJ 프로필에 AJ 페르소나 대신 노출
  bjName?: string | null
  // 지금 이 게임을 추천 게임으로 방송 중인 라이브(카메라/링크) — 있으면 아바타 대신 표시
  bjLive?: LiveInfo | null
}

// 다른 시청자 이름 마스킹 — 앞 4글자만 보이고 나머지는 ** (개인정보 보호)
const maskName = (name: string) => { const n = (name || '').trim(); return n.length > 4 ? n.slice(0, 4) + '**' : n }

const AUTO_COMMENTARY = [
  '지금 이 순간 게임에서 어떤 일이 벌어지고 있는지 게임 요소를 구체적으로 언급하며 한 문장 중계해줘.',
  '플레이어가 지금 어떤 도전을 하고 있을지 게임 메카닉 기반으로 한 문장 방송해줘.',
  '게임에 나오는 적, 장애물, 아이템 중 하나를 언급하며 현재 상황을 외쳐줘.',
  '플레이어가 방금 어떤 행동을 했을지 게임 규칙 기반으로 추측해서 반응해줘.',
  '이 게임의 핵심 승부처! 지금 가장 중요한 게임 요소를 짧게 해설해줘.',
  '점수, 체력, 스테이지 같은 게임 상태를 언급하며 현재 중계해줘.',
  '플레이어가 잘하고 있는지 못하고 있는지 게임 맥락에 맞게 짧게 외쳐줘.',
]

export default function AiBjPanel({ gameId, genre, gameTitle, gameDescription, agentConfig, bjAvatarConfig, myAvatarConfig, bjName, bjLive }: Props) {
  const persona = AJ_PERSONAS[genre]
  // 제작자가 라이브 방송(ON AIR)을 켜 두었으면 아바타 대신 영상이 BJ 자리에 나온다 (아바타 TTS 는 꺼짐)
  const camera = bjLive ?? null
  const stageConfig = myAvatarConfig ?? bjAvatarConfig ?? null
  const bjAvatar = camera ? <LiveView live={camera} /> : <JeumtoBjOverlay config={stageConfig} />
  // 하단 BJ 프로필 — 제작자 에이전트 이름 + 아바타(없으면 AJ 페르소나 fallback)
  const bjLabel = myAvatarConfig ? (agentConfig?.name?.trim() || bjName?.trim() || persona.name) : (bjName?.trim() || persona.name)
  // 채팅에서 AJ(스트리머) 표기 — 게임을 만든 회원의 닉네임 (없을 때만 장르 페르소나)
  const ajChatName = bjName?.trim() || persona.name
  const bjPic = stageConfig?.previewUrl ?? null
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // 아바타를 데스크탑/모바일 한 곳에만 마운트하기 위한 뷰포트 감지
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  // 모바일 — 채팅 접기/아바타 숨기기 (PC 와 같은 오버레이 스타일)
  const [mChatOpen, setMChatOpen] = useState(false)  // 모바일은 기본 접힘 — 게임 화면 확보, 새 메시지는 배지로
  const [mAvatarHidden, setMAvatarHidden] = useState(true)  // 모바일은 기본 숨김(게임 컨트롤러 공간) — 배지의 프로필을 탭하면 보임
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
  const joinedRef = useRef(false); useEffect(() => { joinedRef.current = joined }, [joined])
  const policyRef = useRef<{ version: number; rules: unknown[]; summary: string | null } | null>(null)
  const manifestRef = useRef<Record<string, unknown> | null>(null)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      const d = e.data as { type?: string; manifest?: Record<string, unknown>; samples?: unknown[] } | null
      if (d?.type === 'vibrex:manifest') manifestRef.current = d.manifest ?? null
      // 인간 플레이 데모 — 사람이 직접 플레이하는 동안 (상태, 입력) 샘플이 25개씩 온다 → 서버에 저장(모방 학습 재료)
      if (d?.type === 'vibrex:demo' && Array.isArray(d.samples) && gameId && !joinedRef.current) fetch('/api/ai-bj/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demo', gameId, samples: d.samples }), keepalive: true }).catch(() => {})
    }
    window.addEventListener('message', h); return () => window.removeEventListener('message', h)
  }, [gameId])
  const [canJoin, setCanJoin] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)  // 채팅 전체 내역 펼치기
  // 음성 입력 — 브라우저 음성인식(한국어)으로 말하면 채팅에 텍스트로 입력된다. (지원 브라우저에서만 버튼 노출)
  const [listening, setListening] = useState(false)
  const recogRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const speechSupported = typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
  const toggleMic = () => {
    if (listening) { recogRef.current?.stop(); return }
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition
    if (!SR) return
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const rec: any = new (SR as any)()
      rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1
      let finalText = ''
      rec.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t } setInput((finalText + interim).trim()) }
      rec.onerror = () => setListening(false)
      rec.onend = () => { setListening(false); recogRef.current = null }
      recogRef.current = rec; setListening(true); rec.start()
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch { setListening(false) }
  }
  const renderMic = (size = 32) => speechSupported ? (
    <button onClick={toggleMic} aria-label={listening ? '음성 입력 중지' : '음성으로 말하기'} title={listening ? '듣는 중… (탭하면 중지)' : '음성으로 말하기'}
      className={`shrink-0 rounded-full flex items-center justify-center transition ${listening ? 'bg-[#ef4444] text-white animate-pulse' : 'bg-white/15 text-white hover:bg-white/25'}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>
    </button>
  ) : null
  // 표준 게임(/play/, 같은 오리진) = 아바타가 게임 안에 들어가 직접 플레이·학습.
  // 외부 게임(다른 도메인) = 브라우저 보안상 게임 안엔 못 들어가므로, 화면 위에 떠서 응원하는 '동반 모드'로 참여한다.
  const gameFrame = () => Array.from(document.querySelectorAll('iframe')).find(f => { try { return new URL(f.src, location.href).pathname.startsWith('/play/') } catch { return false } }) ?? null
  const anyFrame = () => document.querySelector('iframe')
  const [companion, setCompanion] = useState<{ image: string } | null>(null)
  const ackRef = useRef(false)
  useEffect(() => { const iv = setInterval(() => { const ok = !camera && !!anyFrame(); setCanJoin(prev => (prev === ok ? prev : ok)) }, 700); return () => clearInterval(iv) }, [camera])
  useEffect(() => { const h = (e: MessageEvent) => { if ((e.data as { type?: string })?.type === 'vibrex:avatar-received') ackRef.current = true }; window.addEventListener('message', h); return () => window.removeEventListener('message', h) }, [])
  const flyInto = (image: string, target: DOMRect, opts: { spin?: boolean; scale?: number }) => {
    try {
      const stage = document.querySelector('.aj-stage-desk') as HTMLElement | null
      const from = stage?.getBoundingClientRect(); if (!from) return
      const img = document.createElement('img'); img.src = image; img.alt = ''
      const size = Math.min(from.width, from.height) * 0.8
      img.style.cssText = `position:fixed;left:${from.left + from.width / 2 - size / 2}px;top:${from.top + from.height / 2 - size / 2}px;width:${size}px;height:${size}px;object-fit:contain;z-index:100000;pointer-events:none;filter:drop-shadow(0 8px 20px rgba(0,0,0,.6));transition:transform .85s cubic-bezier(.4,0,.2,1),opacity .85s ease;`
      document.body.appendChild(img)
      requestAnimationFrame(() => requestAnimationFrame(() => { const dx = target.left + target.width / 2 - (from.left + from.width / 2), dy = target.top + target.height / 2 - (from.top + from.height / 2); img.style.transform = `translate(${dx}px, ${dy}px) scale(${opts.scale ?? 0.25})${opts.spin ? ' rotate(360deg)' : ''}`; img.style.opacity = '0' }))
      setTimeout(() => img.remove(), 950)
    } catch { /* ignore */ }
  }
  useEffect(() => {
    const onSnap = (e: Event) => {
      const image = (e as CustomEvent<{ image: string }>).detail?.image; if (!image) return
      const f = gameFrame(); const tgt = f ?? anyFrame(); if (!tgt) return
      const rect = tgt.getBoundingClientRect()
      flyInto(image, rect, { spin: true })
      ackRef.current = false
      const win = f?.contentWindow
      setTimeout(async () => {
        if (win) {
          win.postMessage({ type: 'vibrex:avatar', image, name: bjLabel }, '*')
          if (gameId) { try { const r = await fetch(`/api/ai-bj/coach?gameId=${gameId}`); const j = await r.json(); if (j.policy) { policyRef.current = j.policy; win.postMessage({ type: 'vibrex:policy', policy: j.policy }, '*') } if (j.brain) win.postMessage({ type: 'vibrex:brain', brain: j.brain }, '*') } catch { /* ignore */ } }
          win.postMessage({ type: 'vibrex:autopilot', on: true }, '*')
          win.postMessage({ type: 'vibrex:manifest-request' }, '*')
        }
        setJoined(true)
        // 브리지가 심어졌으면(우리 오리진·프록시 성공) ack 가 온다 → 진짜 AI 참여. 안 오면(순수 외부) 동반 모드로 표시.
        setTimeout(() => { if (!ackRef.current) setCompanion({ image }); else setCompanion(null) }, 1200)
      }, 700)
    }
    window.addEventListener('avatar:snapshot', onSnap)
    return () => window.removeEventListener('avatar:snapshot', onSnap)
  }, [bjLabel, gameId])
  const joinGame = () => window.dispatchEvent(new CustomEvent('avatar:snapshot-request'))
  const leaveGame = () => { const w = gameFrame()?.contentWindow; w?.postMessage({ type: 'vibrex:autopilot', on: false }, '*'); w?.postMessage({ type: 'vibrex:avatar-remove' }, '*'); setCompanion(null); setJoined(false) }
  const avatarVisible = (!!camera || speaking) && !joined
  // PC 채팅 접기 — 게임 버튼을 가릴 때 왼쪽으로 밀어 넣는다 (기억)
  const [chatOpen, setChatOpen] = useState(() => { try { return localStorage.getItem('aj-chat-open') !== '0' } catch { return true } })
  const toggleChat = () => setChatOpen(v => { try { localStorage.setItem('aj-chat-open', v ? '0' : '1') } catch { /* ignore */ } return !v })
  // 접힌 동안 새로 올라온 메시지 수 — 펼치면 0
  const [seenCount, setSeenCount] = useState(0)
  const anyOpen = isMobile ? mChatOpen : chatOpen
  const unread = anyOpen ? 0 : Math.max(0, messages.length - seenCount)
  useEffect(() => { if (anyOpen) { const t = setTimeout(() => setSeenCount(messages.length), 0); return () => clearTimeout(t) } }, [messages.length, anyOpen])
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


  const isStreamingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])
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

  // Core AJ stream function
  const streamAj = useCallback(async (
    prompt: string,
    addAsUserMsg: boolean,
    isAuto = false,
    agentName?: string,
    situationOverride?: string,
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
          // MLPilot v2 — 상황 라벨: 인트로/자동 중계/시청자 답변/에이전트 답변
          situation: situationOverride ?? (isAuto ? 'commentary' : agentName ? 'agent_reply' : addAsUserMsg ? 'reply' : 'intro'),
          gameId: gameId ?? null,
          viewerText: addAsUserMsg ? prompt : null,
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
  }, [genre, gameTitle, gameId])

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

  // 게임 이벤트(시작/득점/레벨/게임오버/클리어) → 상황에 맞는 한마디 (8초 쿨다운, 클리어·게임오버는 즉시)
  const lastEvtAt = useRef(0)
  useEffect(() => {
    const h = (e: Event) => {
      const { name, data } = (e as CustomEvent<{ name: string; data: { score?: number; level?: unknown } | null }>).detail
      const now = Date.now(); const urgent = name === 'over' || name === 'clear' || name === 'start'
      if (!urgent && now - lastEvtAt.current < 8000) return
      if (isStreamingRef.current && !urgent) return
      lastEvtAt.current = now
      const score = typeof data?.score === 'number' ? data.score : null
      if (joinedRef.current && gameId && (name === 'over' || name === 'clear')) {
        // 자동 학습 — 한 판 결과를 보내고, 스스로 개선한 새 정책이 오면 봇에 주입 + AJ 가 알려준다
        fetch('/api/ai-bj/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'episode', gameId, score: score ?? 0, cleared: name === 'clear', durationSec: (e as CustomEvent<{ sec?: number }>).detail?.sec ?? 0, manifest: manifestRef.current, genre, gameTitle }) })
          .then(r => r.json()).then(j => {
            if (j?.brain) gameFrame()?.contentWindow?.postMessage({ type: 'vibrex:brain', brain: j.brain }, '*')
            if (j?.policy) {
              policyRef.current = j.policy
              gameFrame()?.contentWindow?.postMessage({ type: 'vibrex:policy', policy: j.policy }, '*')
              const line = `${j.policy.summary ?? '스스로 조금 더 배웠어'} (자동 학습 v${j.policy.version})`
              setMessages(prev => [...prev, { role: 'assistant', content: line, ts: Date.now() }])
              window.dispatchEvent(new CustomEvent('avatar:speak', { detail: { text: j.policy.summary ?? line } }))
            }
          }).catch(() => {})
      }
      const prompt = name === 'start' ? `"${gameTitle}" 플레이 시작! 한마디로 응원.` : name === 'over' ? `게임오버${score != null ? ` (점수 ${score})` : ''}. 먼저 공감 한 문장, 그다음 다시 하자고 짧게.` : name === 'clear' ? `드디어 최종 클리어!${score != null ? ` 최종 점수 ${score}.` : ''} 축하와 감탄, 성취를 한껏 띄워줘.` : name === 'level' ? `레벨/스테이지 업${data?.level != null ? ` (${String(data.level)})` : ''}! 짧게 환호.` : name === 'combo' ? '콤보 터졌다! 짧고 신나게.' : name === 'fail' ? '아쉬운 실수. 짧게 위로하고 팁 하나.' : `점수 ${score ?? ''} 돌파! 짧게 반응.`
      streamAj(prompt, false, true, undefined, `event_${name === 'over' ? 'over' : name === 'clear' ? 'clear' : name === 'level' ? 'level' : name === 'combo' ? 'combo' : name === 'fail' ? 'fail' : name === 'start' ? 'start' : 'score'}`)
    }
    window.addEventListener('aj:game-event', h)
    return () => window.removeEventListener('aj:game-event', h)
  }, [gameTitle, streamAj])

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

  // 내 AI 가 대신 플레이 중일 때 말을 걸면 = 코칭. 조언을 정책으로 컴파일해 봇에 주입하고, AJ 가 배운 내용을 답한다.
  const coach = async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text, source: 'user', ts: Date.now() }, { role: 'assistant', content: '', ts: Date.now() }])
    setIsStreaming(true)
    const put = (c: string) => setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: c }; return u })
    try {
      const r = await fetch('/api/ai-bj/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, message: text, manifest: manifestRef.current, genre, gameTitle }) })
      const j = await r.json()
      if (!r.ok || !j.policy) { put('음… 그건 아직 못 배우겠어. 다르게 말해줄래?'); return }
      policyRef.current = j.policy
      gameFrame()?.contentWindow?.postMessage({ type: 'vibrex:policy', policy: j.policy }, '*')
      const n = Array.isArray(j.policy.rules) ? j.policy.rules.length : 0
      const reply = `${j.policy.summary ?? '알았어, 반영했어!'} (학습 v${j.policy.version}${n ? ` · 규칙 ${n}개` : ''})`
      put(reply)
      window.dispatchEvent(new CustomEvent('avatar:speak', { detail: { text: j.policy.summary ?? reply } }))
    } catch { put('잠깐 끊겼어! 다시 말해줘 💫') } finally { setIsStreaming(false) }
  }
  // 보내기 — AJ 가 말하는 중이면 끝날 때까지 잠깐 기다렸다가 보낸다 (입력창은 절대 비활성화하지 않는다: 포커스가 튕기므로)
  const waitIdle = () => new Promise<void>(res => { const t = setInterval(() => { if (!isStreamingRef.current) { clearInterval(t); res() } }, 120); setTimeout(() => { clearInterval(t); res() }, 15000) })
  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    setInput('')
    await waitIdle()
    if (joinedRef.current && gameId && gameFrame()) { await coach(text.trim()); return }
    await streamAj(text, true)
  }

  return (
    <>
      {/* 동반 모드 — 외부 게임: 아바타가 화면 하단 중앙에서 함께 응원 (PC·모바일 공통) */}
      {joined && companion && (
        <div className="absolute inset-x-0 bottom-[92px] md:bottom-16 z-10 pointer-events-none flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={companion.image} alt="" className="w-[76px] h-[76px] object-contain avatar-bob drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]" />
          <span className="rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-[10.5px] font-bold text-white">{bjLabel} 응원 중 📣</span>
        </div>
      )}
      {/* ─── Desktop: 게임 위 오버레이 채팅 — 스트리밍 스타일, 위로 갈수록 자연스럽게 사라진다 ─── */}
      <div className="hidden md:block absolute inset-0 pointer-events-none z-10">
        {/* 좌하단 메시지 스택 (+ 입력) — 접으면 왼쪽으로 슬라이드 */}
        <div className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: chatOpen ? 'translateX(0)' : 'translateX(-400px)' }}>
        {/* 펼치기 버튼 — 전체 채팅 내역을 위로 확장 */}
        <button onClick={() => setChatExpanded(v => !v)} className="pointer-events-auto absolute left-4 bottom-[74px] z-10 h-7 px-3 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-black/80 transition-colors">
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform ${chatExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
          {chatExpanded ? '접기' : `내역 펼치기${messages.length > 0 ? ` (${messages.length})` : ''}`}
        </button>
        <div className={`${chatExpanded ? '' : 'chat-fade'} absolute left-4 bottom-[110px] w-[360px] flex flex-col justify-end ${chatExpanded ? 'overflow-y-auto rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 p-2.5' : 'overflow-hidden'}`}
          style={{ maxHeight: chatExpanded ? 'min(70vh, calc(100vh - 190px))' : '58%' }}>
          <div className="space-y-1.5">
            {(chatExpanded ? messages : messages.slice(-14)).map((msg, i, arr) => (
              <div key={i} className="flex items-start gap-2 transition-opacity duration-1000" style={{ opacity: chatExpanded ? 1 : ageOpacity(msg.ts) }}>
                <div className="max-w-full text-[13px] leading-relaxed px-3 py-1.5 rounded-2xl text-white shadow-[0_1px_4px_rgba(0,0,0,0.4)] bg-black/85">
                  <span className={`font-bold mr-1.5 ${
                    msg.role === 'assistant' ? 'text-sky-300' : msg.source === 'agent' ? 'text-purple-300' : 'text-[#7ef0ff]'
                  }`}>
                    {msg.role === 'assistant' ? ajChatName : msg.source === 'agent' ? maskName(msg.agentName ?? 'AGENT') : '나'}
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(input) }}
              placeholder={joined ? "AI에게 가르치기… (위 버튼을 누르거나 직접 말해요)" : "AJ에게 말걸기..."}
              className="flex-1 bg-transparent text-white text-[13px] placeholder-white/50 focus:outline-none disabled:opacity-50"
            />
            {renderMic()}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
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
          <div className={`relative aj-stage aj-stage-desk aj-drag ${camera ? 'aj-stage-cam' : ''} ${joined ? 'aj-stage-joined' : avatarVisible ? 'aj-stage-on' : 'aj-stage-off'}`} style={{ height: '200px' }}
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
          <div className="aj-drag relative mt-0 flex items-center gap-2.5 bg-black/40 backdrop-blur-md rounded-full pl-1.5 pr-1.5 py-1.5 border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.45)]" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} title="드래그해서 위치 이동">
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

      {/* ─── Mobile: PC 와 같은 오버레이 — 좌하단 채팅(접기), 우하단 아바타(드래그·숨기기) + 네임 배지 ─── */}
      <div className="md:hidden absolute inset-0 pointer-events-none z-10">
        {/* 채팅 스택 + 입력 — 접으면 왼쪽으로 슬라이드 */}
        <div className="absolute inset-0 transition-transform duration-400 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: mChatOpen ? 'translateX(0)' : 'translateX(-110%)' }}>
          <button onClick={() => setChatExpanded(v => !v)} className="pointer-events-auto absolute left-2 bottom-[60px] z-10 h-6 px-2.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white/90 text-[10.5px] font-semibold flex items-center gap-1">
            <svg viewBox="0 0 24 24" className={`w-3 h-3 transition-transform ${chatExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
            {chatExpanded ? '접기' : `펼치기${messages.length ? ` ${messages.length}` : ''}`}
          </button>
          <div className={`${chatExpanded ? '' : 'chat-fade'} absolute left-2 right-[136px] bottom-[86px] flex flex-col justify-end ${chatExpanded ? 'overflow-y-auto rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 p-2' : 'overflow-hidden'}`} style={{ maxHeight: chatExpanded ? '52vh' : '42%' }}>
            <div className="space-y-1">
              {(chatExpanded ? messages : messages.slice(-10)).map((msg, i) => (
                <div key={i} className="flex transition-opacity duration-1000" style={{ opacity: chatExpanded ? 1 : ageOpacity(msg.ts) }}>
                  <div className="max-w-full text-[12px] leading-snug px-2.5 py-1 rounded-2xl text-white bg-black/80 shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                    <span className={`font-bold mr-1 ${msg.role === 'assistant' ? 'text-sky-300' : msg.source === 'agent' ? 'text-purple-300' : 'text-[#7ef0ff]'}`}>{msg.role === 'assistant' ? ajChatName : msg.source === 'agent' ? maskName(msg.agentName ?? 'AGENT') : '나'}</span>{msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute left-2 right-[150px] bottom-2.5 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-full pl-3.5 pr-1 py-1 border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(input) }}
                placeholder={joined ? 'AI에게 가르치기…' : 'AJ에게 말걸기...'} className="flex-1 min-w-0 bg-transparent text-white text-[13px] placeholder-white/50 focus:outline-none" />
              {renderMic(32)}
              <button onClick={() => sendMessage(input)} disabled={!input.trim()} aria-label="보내기" className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] text-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
            </div>
          </div>
        </div>
        {/* 채팅 접기/펼치기 탭 */}
        <button onClick={() => setMChatOpen(v => !v)} aria-label={mChatOpen ? '채팅 접기' : '채팅 펼치기'}
          className="pointer-events-auto absolute bottom-[18px] h-8 w-6 rounded-r-md bg-black/55 backdrop-blur-md border border-l-0 border-white/15 text-white/80 flex items-center justify-center transition-all duration-400"
          style={{ left: mChatOpen ? 'calc(100% - 148px)' : 0 }}>
          <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform duration-400 ${mChatOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          {!mChatOpen && unread > 0 && <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">{unread > 99 ? '99+' : unread}</span>}
        </button>
        {/* 우하단 — 아바타(드래그 이동, 배지 탭으로 숨기기/보이기) + 네임 배지 */}
        <div className="absolute right-2 bottom-2.5 w-[116px] pointer-events-auto select-none" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}>
          <div className={`relative aj-stage aj-stage-desk aj-drag ${camera ? 'aj-stage-cam' : ''} ${joined ? 'aj-stage-joined' : avatarVisible && !mAvatarHidden ? 'aj-stage-on' : 'aj-stage-off'}`} style={{ height: camera ? 90 : 132 }}
            onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
            {isMobile && bjAvatar}
            {speaking && !camera && !mAvatarHidden && (
              <div className="aj-typing" aria-hidden><svg viewBox="0 0 64 56" className="w-full h-full"><path d="M32 6c14.9 0 26 9 26 20.5S46.9 47 32 47c-2.1 0-4.2-.2-6.2-.5L14 53l2.4-10.8C9.9 38.4 6 32.8 6 26.5 6 15 17.1 6 32 6Z" fill="rgba(10,12,18,0.6)" stroke="#ffffff" strokeWidth="3.5" strokeLinejoin="round" /><circle cx="21" cy="27" r="3.6" fill="#ffffff" className="aj-dot" /><circle cx="32" cy="27" r="3.6" fill="#ffffff" className="aj-dot" style={{ animationDelay: '.18s' }} /><circle cx="43" cy="27" r="3.6" fill="#ffffff" className="aj-dot" style={{ animationDelay: '.36s' }} /></svg></div>
            )}
          </div>
          <div className="aj-drag relative flex items-center gap-1.5 bg-black/45 backdrop-blur-md rounded-full pl-1 pr-1 py-1 border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.45)]" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
            <button onClick={e => { e.stopPropagation(); setMAvatarHidden(v => !v) }} onPointerDown={e => e.stopPropagation()} className="relative shrink-0" aria-label={mAvatarHidden ? '아바타 보이기' : '아바타 숨기기'} title={mAvatarHidden ? '아바타 보이기' : '아바타 숨기기'}>
              <div className="avatar-ring"><div className="avatar-wave w-7 h-7 rounded-full overflow-hidden"><Image src={bjPic ?? '/aibot.png'} alt={bjLabel} width={28} height={28} className={`w-full h-full object-cover ${bjPic ? 'avatar-bob object-top' : ''}`} unoptimized /></div></div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-black/80 ${mAvatarHidden ? 'bg-[#9ca3af]' : 'bg-[#ef4444] animate-pulse'}`} />
            </button>
            <div className="min-w-0 flex-1 leading-tight"><p className="font-pixel text-[9px] text-white truncate">{bjLabel}</p><p className="text-[8px] font-bold tracking-[0.12em] text-[#ff6b6b]">{mAvatarHidden ? 'HIDDEN' : 'LIVE'}</p></div>
            {canJoin && <button onClick={e => { e.stopPropagation(); joined ? leaveGame() : joinGame() }} onPointerDown={e => e.stopPropagation()} className={`h-6 px-2 rounded-full text-[10px] font-bold shrink-0 ${joined ? 'bg-white/15 text-white' : 'bg-white text-[#111]'}`}>{joined ? '복귀' : '참여'}</button>}
          </div>
        </div>
      </div>
    </>
  )
}
