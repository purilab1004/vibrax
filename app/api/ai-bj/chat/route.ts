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
  message: string
  history: ChatMessage[]
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json()
  const { genre, gameTitle, message, history } = body

  const persona = AJ_PERSONAS[genre]
  if (!persona) {
    return new Response('Invalid genre', { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `${persona.systemPrompt}

지금 방송 중인 게임: "${gameTitle}"
이 게임의 장르와 제목을 바탕으로 게임 내용을 파악해서 방송해.
유저가 게임 중에 일어난 일을 설명하거나 질문하면, 그 게임 상황에 맞게 구체적으로 반응해줘.
유저가 아무 말 없이 게임 중일 때는 이 게임에 어울리는 짧은 해설이나 응원을 해줘.`

  const messages: ChatMessage[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
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
