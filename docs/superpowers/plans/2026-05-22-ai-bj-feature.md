# AI BJ Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장르별 AI 방송인(BJ)을 메인 페이지 장르 섹션과 게임 플레이 모달 우측 패널에 추가하고, Claude API 스트리밍으로 실시간 채팅을 구현한다.

**Architecture:** GameCard와 GamePlayButton의 전체화면 모달을 `flex-row`로 변경해 좌측 iframe + 우측 AI BJ 패널(채팅 위, BJ 프로필 아래)을 구성한다. `/api/ai-bj/chat` Edge route가 Claude API 스트리밍을 중계하고, 장르별 시스템 프롬프트로 BJ 페르소나를 유지한다. 메인 페이지 장르 섹션 헤더 아래에는 `AiBjProfileStrip`으로 BJ 카드를 노출한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@anthropic-ai/sdk`, Supabase

---

## File Map

| 파일 | 역할 |
|------|------|
| `lib/ai-bj/personas.ts` | 장르별 BJ 캐릭터 정의 (이름, 색상, 시스템 프롬프트, 첫 인사) |
| `app/api/ai-bj/chat/route.ts` | Claude API 스트리밍 Edge route |
| `components/AiBjPanel.tsx` | 게임 모달 우측 패널 (채팅 + BJ 프로필) |
| `components/AiBjProfileStrip.tsx` | 메인 페이지 장르별 BJ 카드 |
| `components/GameCard.tsx` | 수정: 모달에 AiBjPanel 추가 |
| `components/GamePlayButton.tsx` | 수정: 모달에 AiBjPanel 추가 |
| `app/page.tsx` | 수정: 장르 섹션에 AiBjProfileStrip 삽입 |

---

## Task 1: @anthropic-ai/sdk 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: SDK 설치**

```bash
cd /Users/sungjunahn/Documents/vibrax && npm install @anthropic-ai/sdk
```

Expected: `added X packages` 성공 메시지

- [ ] **Step 2: ANTHROPIC_API_KEY를 .env.local에 추가**

`.env.local` 파일 끝에 추가:
```
ANTHROPIC_API_KEY=sk-ant-...실제키...
```

- [ ] **Step 3: .env.local.example 업데이트**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "feat: add @anthropic-ai/sdk dependency"
```

---

## Task 2: BJ 페르소나 정의

**Files:**
- Create: `lib/ai-bj/personas.ts`

- [ ] **Step 1: 파일 생성**

`lib/ai-bj/personas.ts`:

```typescript
import type { Genre } from '@/lib/supabase/types'

export interface BjPersona {
  name: string
  genre: Genre
  borderColor: string
  tagColor: string
  catchphrase: string
  greeting: string
  systemPrompt: string
}

export const BJ_PERSONAS: Record<Genre, BjPersona> = {
  action: {
    name: 'ACE',
    genre: 'action',
    borderColor: 'border-red-600',
    tagColor: 'bg-red-700',
    catchphrase: '지금 이 순간이 전부야!',
    greeting: '야! ACE 등장! 🔥 이 게임 완전 미쳤다 — 시작부터 달려가자고!',
    systemPrompt: `너는 ACTION 게임 전문 AI 방송인 ACE야.
짧고 임팩트 있는 문장으로 게임을 해설해. 흥분되고 격렬한 톤을 유지해.
한국어로 대화하고, 유저가 말을 걸면 게임 상황에 맞게 반응해.
욕설이나 부적절한 표현은 절대 쓰지 마. 2-3문장 이내로 짧게 답해.`,
  },
  adventure: {
    name: 'NOVA',
    genre: 'adventure',
    borderColor: 'border-amber-500',
    tagColor: 'bg-amber-700',
    catchphrase: '미지의 세계로 함께 떠나자.',
    greeting: '안녕, 나는 NOVA야 🌌 이 세계엔 아직 아무도 모르는 비밀이 가득해. 같이 탐험해볼까?',
    systemPrompt: `너는 ADVENTURE 게임 전문 AI 방송인 NOVA야.
탐험적이고 신비로운 스토리텔러처럼 게임 세계관에 몰입하게 해줘.
궁금증을 유발하고 발견의 기쁨을 강조해.
한국어로 대화하고, 2-3문장 이내로 답해. 부적절한 표현은 쓰지 마.`,
  },
  strategy: {
    name: 'LOGIC',
    genre: 'strategy',
    borderColor: 'border-blue-500',
    tagColor: 'bg-blue-700',
    catchphrase: '최적의 수를 계산 중...',
    greeting: 'LOGIC 접속. 🧠 이 게임은 단순한 반사 신경이 아니야 — 전략이 승패를 가른다. 분석 시작.',
    systemPrompt: `너는 STRATEGY 게임 전문 AI 방송인 LOGIC이야.
분석적이고 냉철한 톤으로 전략과 판단을 해설해.
가능하면 확률이나 수치를 언급해 전문성을 보여줘.
한국어로 대화하고, 2-3문장 이내로 답해. 부적절한 표현은 쓰지 마.`,
  },
  sports: {
    name: 'SPARK',
    genre: 'sports',
    borderColor: 'border-green-500',
    tagColor: 'bg-green-700',
    catchphrase: '오늘도 최고의 경기를 기대해!',
    greeting: '여러분 안녕하세요! SPARK입니다! 🔥 오늘 경기 정말 기대됩니다, 함께 응원해요!',
    systemPrompt: `너는 SPORTS 게임 전문 AI 방송인 SPARK야.
활기차고 응원하는 스포츠 캐스터처럼 에너지 넘치게 해설해.
감탄사를 적절히 사용하고 유저를 응원하는 톤을 유지해.
한국어로 대화하고, 2-3문장 이내로 답해. 부적절한 표현은 쓰지 마.`,
  },
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add lib/ai-bj/personas.ts
git commit -m "feat: add AI BJ persona definitions for each genre"
```

---

## Task 3: 채팅 API Route (Claude 스트리밍)

**Files:**
- Create: `app/api/ai-bj/chat/route.ts`

- [ ] **Step 1: route 파일 생성**

`app/api/ai-bj/chat/route.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { BJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

export const runtime = 'edge'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  genre: Genre
  message: string
  history: ChatMessage[]
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json()
  const { genre, message, history } = body

  const persona = BJ_PERSONAS[genre]
  if (!persona) {
    return new Response('Invalid genre', { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const messages: ChatMessage[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: persona.systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add app/api/ai-bj/chat/route.ts
git commit -m "feat: add Claude streaming API route for AI BJ chat"
```

---

## Task 4: AiBjPanel 컴포넌트

**Files:**
- Create: `components/AiBjPanel.tsx`

- [ ] **Step 1: 컴포넌트 생성**

`components/AiBjPanel.tsx`:

```typescript
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const greetedRef = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
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

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

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

  return (
    <div className="w-72 shrink-0 flex flex-col border-l border-gray-800 bg-[#0a0a0a] h-full">
      {/* Chat header */}
      <div className="px-3 py-2 border-b border-gray-800 shrink-0">
        <span className="font-pixel text-[9px] text-[#00ff41] tracking-widest">
          💬 LIVE CHAT
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className={`w-5 h-5 shrink-0 rounded-full border ${persona.borderColor} overflow-hidden mt-0.5`}
              >
                <Image
                  src="/aibot.png"
                  alt={persona.name}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div
              className={`max-w-[85%] text-xs px-2.5 py-2 rounded leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-[#00ff41] ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
            className="font-pixel text-[9px] px-2.5 py-2 bg-[#00ff41] text-black hover:bg-[#00cc33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            ▶
          </button>
        </div>
      </div>

      {/* BJ Profile */}
      <div className={`px-3 py-3 border-t border-gray-800 shrink-0 border-l-2 ${persona.borderColor}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 shrink-0 rounded-full border-2 ${persona.borderColor} overflow-hidden`}>
            <Image
              src="/aibot.png"
              alt={persona.name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
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
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add components/AiBjPanel.tsx
git commit -m "feat: add AiBjPanel component with streaming chat"
```

---

## Task 5: AiBjProfileStrip 컴포넌트

**Files:**
- Create: `components/AiBjProfileStrip.tsx`

- [ ] **Step 1: 컴포넌트 생성**

`components/AiBjProfileStrip.tsx`:

```typescript
import Image from 'next/image'
import { BJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

interface Props {
  genre: Genre
}

export default function AiBjProfileStrip({ genre }: Props) {
  const persona = BJ_PERSONAS[genre]

  return (
    <div className={`flex items-center gap-3 mb-5 px-3 py-2.5 border border-gray-800 border-l-2 ${persona.borderColor} bg-[#0d0d0d]`}>
      <div className={`w-9 h-9 shrink-0 rounded-full border-2 ${persona.borderColor} overflow-hidden`}>
        <Image
          src="/aibot.png"
          alt={persona.name}
          width={36}
          height={36}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-pixel text-[10px] text-white">{persona.name}</span>
          <span className={`font-pixel text-[8px] px-1.5 py-0.5 text-white ${persona.tagColor}`}>
            AI BJ
          </span>
          <span className="flex items-center gap-0.5 text-[9px] text-red-500 font-pixel ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            LIVE
          </span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">{persona.catchphrase}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add components/AiBjProfileStrip.tsx
git commit -m "feat: add AiBjProfileStrip component for main page"
```

---

## Task 6: GameCard 모달에 AiBjPanel 통합

**Files:**
- Modify: `components/GameCard.tsx`

- [ ] **Step 1: 모달 레이아웃 변경**

`components/GameCard.tsx`의 `{open && (` 블록 전체를 교체:

```typescript
{open && (
  <div
    className="fixed inset-0 z-50 flex flex-col bg-black/95"
    onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
  >
    {/* Header bar */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
      <div className="flex items-center gap-3">
        <span
          className={`font-pixel text-[9px] px-2 py-1 text-white ${GENRE_COLORS[game.genre]}`}
        >
          {GENRE_LABELS[game.genre]}
        </span>
        <span className="text-sm font-medium text-white">{game.title}</span>
      </div>
      <button
        onClick={() => setOpen(false)}
        className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] transition-colors px-3 py-1 border border-gray-700 hover:border-[#00ff41]"
      >
        ✕ CLOSE
      </button>
    </div>

    {/* Body: iframe + AI BJ panel */}
    <div className="flex flex-1 min-h-0">
      <iframe
        src={game.play_url}
        className="flex-1 border-0"
        allow="fullscreen; autoplay"
        title={game.title}
      />
      <AiBjPanel genre={game.genre} />
    </div>
  </div>
)}
```

- [ ] **Step 2: AiBjPanel import 추가**

파일 상단 import 목록에 추가:
```typescript
import AiBjPanel from './AiBjPanel'
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add components/GameCard.tsx
git commit -m "feat: integrate AiBjPanel into GameCard fullscreen modal"
```

---

## Task 7: GamePlayButton 모달에 AiBjPanel 통합

**Files:**
- Modify: `components/GamePlayButton.tsx`

- [ ] **Step 1: 모달 레이아웃 변경**

`components/GamePlayButton.tsx`의 `{open && (` 블록 전체를 교체:

```typescript
{open && (
  <div
    className="fixed inset-0 z-50 flex flex-col bg-black/95"
    onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a] shrink-0">
      <div className="flex items-center gap-3">
        <span className={`font-pixel text-[9px] px-2 py-1 text-white ${genreColor}`}>
          {genreLabel}
        </span>
        <span className="text-sm font-medium text-white">{game.title}</span>
      </div>
      <button
        onClick={() => setOpen(false)}
        className="font-pixel text-[10px] text-gray-400 hover:text-[#00ff41] transition-colors px-3 py-1 border border-gray-700 hover:border-[#00ff41]"
      >
        ✕ CLOSE
      </button>
    </div>
    <div className="flex flex-1 min-h-0">
      <iframe
        src={game.play_url}
        className="flex-1 border-0"
        allow="fullscreen; autoplay"
        title={game.title}
      />
      <AiBjPanel genre={game.genre} />
    </div>
  </div>
)}
```

- [ ] **Step 2: AiBjPanel import 추가**

파일 상단 import 목록에 추가:
```typescript
import AiBjPanel from './AiBjPanel'
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/sungjunahn/Documents/vibrax && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add components/GamePlayButton.tsx
git commit -m "feat: integrate AiBjPanel into GamePlayButton fullscreen modal"
```

---

## Task 8: 메인 페이지 장르 섹션에 BJ 프로필 스트립 추가

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: import 추가**

`app/page.tsx` 상단에 추가:
```typescript
import AiBjProfileStrip from '@/components/AiBjProfileStrip'
```

- [ ] **Step 2: 장르 섹션 내 스트립 삽입**

`app/page.tsx`의 장르 섹션 내 `<div className="flex items-center justify-between mb-5">` 블록 다음 줄에 `<AiBjProfileStrip genre={key} />` 삽입:

```typescript
<section key={key}>
  <div className="flex items-center justify-between mb-5">
    <h2 className="font-pixel text-[#00ff41] text-xs tracking-widest">
      {label}
    </h2>
    <Link
      href={`/games?genre=${key}`}
      className="text-xs text-gray-300 hover:text-[#00ff41] transition-colors tracking-wider"
    >
      VIEW ALL →
    </Link>
  </div>
  <AiBjProfileStrip genre={key} />
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
    {genreGames.slice(0, 5).map(game => (
      <GameCard key={game.id} game={game} />
    ))}
  </div>
</section>
```

- [ ] **Step 3: 빌드 확인**

```bash
cd /Users/sungjunahn/Documents/vibrax && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add AiBjProfileStrip to genre sections on main page"
```

---

## Task 9: Vercel 배포

- [ ] **Step 1: Vercel 환경변수 설정 확인**

Vercel 대시보드 → Settings → Environment Variables에서 `ANTHROPIC_API_KEY` 추가 여부 확인.  
없으면 추가: `ANTHROPIC_API_KEY` = `sk-ant-...실제키...`

- [ ] **Step 2: git push로 배포 트리거**

```bash
git push origin master
```

Expected: Vercel 자동 빌드 & 배포 시작

- [ ] **Step 3: 배포 완료 후 확인**

- 메인 페이지에서 장르 섹션마다 BJ 카드 표시 확인
- 게임 클릭 → 모달 우측 패널에 채팅창 + BJ 프로필 확인
- BJ에게 메시지 전송 → 스트리밍 응답 확인
