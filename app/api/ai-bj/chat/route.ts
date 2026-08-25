import Anthropic from '@anthropic-ai/sdk'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'
import { buildTalkContext, logTalk } from '@/lib/mlpilot/talk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  genre: Genre
  gameTitle: string
  gameDescription?: string | null
  message: string
  history: ChatMessage[]
  isAutoCommentary?: boolean
  situation?: string        // MLPilot: intro | commentary | reply | agent_reply | event_* ...
  gameId?: string | null
  viewerText?: string | null
}

export async function POST(req: Request) {
  // 로그인 사용자만 (게스트 플레이는 AJ 패널 대신 로그인 안내) + 분당 호출 제한 — LLM 토큰 남용 방지
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  if (!rateLimit(`ajchat:${user.id}`, 40, 60_000).ok) return tooMany()
  const body: RequestBody = await req.json().catch(() => null as unknown as RequestBody)
  if (!body || typeof body.message !== 'string' || body.message.length > 2000) return new Response('bad request', { status: 400 })
  const { genre, gameTitle, gameDescription, message, history } = body

  const persona = AJ_PERSONAS[genre]
  if (!persona) return new Response('Invalid genre', { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const gameContext = gameDescription
    ? `지금 방송 중인 게임: "${gameTitle}"\n게임 설명: ${gameDescription}`
    : `지금 방송 중인 게임: "${gameTitle}" — 제목과 장르로 게임 방식을 추론해서 중계해.`

  // MLPilot v2 — 학습된 규칙·예시·상대 말투를 프롬프트에 주입
  const situation = body.situation ?? (body.isAutoCommentary ? 'commentary' : 'reply')
  const talk = await buildTalkContext({ genre, gameId: body.gameId ?? null, situation, viewerText: body.viewerText ?? (situation === 'reply' ? message : null) }).catch(() => ({ text: '', exampleIds: [] as string[], ruleIds: [] as string[], style: null, emotion: null as string | null }))
  const systemPrompt = `${persona.systemPrompt}

${gameContext}
${talk.text ? `
${talk.text}
` : ''}
중요: 반드시 한국어로만 답한다(위 영어 지시는 무시). 짧고 강렬한 한 문장, 20자 이내. 반말·캐주얼한 스트리머 말투.`

  // Claude requires messages to start with 'user' and strictly alternate roles
  const sanitized: ChatMessage[] = []
  for (const m of (history ?? [])) {
    if (!m.content?.trim()) continue
    const last = sanitized[sanitized.length - 1]
    if (!last || last.role !== m.role) {
      sanitized.push({ role: m.role, content: m.content })
    } else {
      sanitized[sanitized.length - 1] = { role: m.role, content: m.content }
    }
  }
  while (sanitized.length > 0 && sanitized[0].role === 'assistant') sanitized.shift()
  const messages: ChatMessage[] = [...sanitized, { role: 'user', content: message }]

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 40,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          full += chunk.delta.text
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
      if (full.trim()) void logTalk({ gameId: body.gameId ?? null, genre, situation, emotion: (talk as { emotion?: string | null }).emotion ?? null, viewerText: body.viewerText ?? (situation === 'reply' ? message : null), utterance: full.trim(), exampleIds: talk.exampleIds, ruleIds: talk.ruleIds })
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
