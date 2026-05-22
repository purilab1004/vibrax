import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const { agentName, agentPersona, gameTitle, genre, history } = await req.json()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `너는 "${agentName}"이라는 이름의 게이머야.
성격: ${agentPersona}
지금 "${gameTitle}" 게임 방송을 보고 있어.
AI 방송인 AJ에게 짧고 자연스럽게 한 마디 해줘. 게임에 대한 감상, 응원, 질문 등 자유롭게.
15자 이내로 아주 짧게.`

  const sanitized: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of (history ?? []).slice(-4)) {
    if (!m.content?.trim()) continue
    const last = sanitized[sanitized.length - 1]
    if (!last || last.role !== m.role) {
      sanitized.push({ role: m.role, content: m.content })
    } else {
      sanitized[sanitized.length - 1] = { role: m.role, content: m.content }
    }
  }
  while (sanitized.length > 0 && sanitized[0].role === 'assistant') sanitized.shift()
  const messages = [
    ...sanitized,
    { role: 'user' as const, content: `"${gameTitle}" 게임 보면서 AJ에게 한마디` },
  ]

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
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
