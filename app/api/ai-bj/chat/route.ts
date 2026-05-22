import Anthropic from '@anthropic-ai/sdk'
import { BJ_PERSONAS } from '@/lib/ai-bj/personas'
import type { Genre } from '@/lib/supabase/types'

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
