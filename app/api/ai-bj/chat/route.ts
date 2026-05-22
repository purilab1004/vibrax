import Anthropic from '@anthropic-ai/sdk'
import { AJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

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
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json()
  const { genre, gameTitle, gameDescription, message, history } = body

  const persona = AJ_PERSONAS[genre]
  if (!persona) return new Response('Invalid genre', { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const gameContext = gameDescription
    ? `지금 방송 중인 게임: "${gameTitle}"\n게임 설명: ${gameDescription}`
    : `지금 방송 중인 게임: "${gameTitle}" — 제목과 장르로 게임 방식을 추론해서 중계해.`

  const systemPrompt = `${persona.systemPrompt}

${gameContext}

규칙: 10자 이내. 한 단어~짧은 감탄 수준으로만.`

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
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
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
