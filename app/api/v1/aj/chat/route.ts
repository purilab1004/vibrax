// POST /api/v1/aj/chat — 내 AJ 와 대화 (크롬 확장·외부 앱). scope: chat
// body: { message, history?: [{role:'user'|'assistant', content}], context?: {title,url,text,genre,situation}, stream?: boolean }
// stream=true → text/plain 청크 스트리밍, 아니면 JSON { reply, name, quota }
import Anthropic from '@anthropic-ai/sdk'
import { authenticateApi, apiJson, apiError, preflight, CORS, refundApiCharge } from '@/lib/aj/api-auth'
import { buildExternalSystem, loadMyGames, ajDisplayName, MODE_MAX_TOKENS, type ChatContext, type ChatMode } from '@/lib/aj/external'
import { logTalk } from '@/lib/mlpilot/talk'
import { logUsage } from '@/lib/llm/usage'

export const runtime = 'nodejs'
export const maxDuration = 60
export const OPTIONS = () => preflight()

interface Msg { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { message?: unknown; history?: unknown; context?: ChatContext; stream?: unknown; mode?: unknown } | null
  const mode: ChatMode = (['chat', 'quiz', 'explain', 'game'] as const).includes(body?.mode as ChatMode) ? (body!.mode as ChatMode) : 'chat'
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > 2000) return apiError(400, 'message required (≤2000 chars)')
  const id = await authenticateApi(req, 'chat')
  if (id instanceof Response) return id
  if (!process.env.ANTHROPIC_API_KEY) return apiError(503, 'llm not configured')

  const ctx: ChatContext = body?.context && typeof body.context === 'object' ? body.context : {}
  const games = await loadMyGames(id.userId, 6)
  const { system, exampleIds, ruleIds, emotion, genre, situation } = await buildExternalSystem(id, games, ctx, message, mode)

  // 역할 교대 정리 (Claude 는 user 로 시작, 교대 필수). 최근 12턴만.
  const sanitized: Msg[] = []
  for (const m of (Array.isArray(body?.history) ? body!.history as Msg[] : []).slice(-12)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) continue
    const c = m.content.slice(0, 2000)
    const last = sanitized[sanitized.length - 1]
    if (!last || last.role !== m.role) sanitized.push({ role: m.role, content: c }); else sanitized[sanitized.length - 1] = { role: m.role, content: c }
  }
  while (sanitized.length && sanitized[0].role === 'assistant') sanitized.shift()
  if (sanitized.length && sanitized[sanitized.length - 1].role === 'user') sanitized.pop()
  const messages: Msg[] = [...sanitized, { role: 'user', content: message }]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = 'claude-haiku-4-5-20251001'
  const stream = client.messages.stream({ model, max_tokens: MODE_MAX_TOKENS[mode], system, messages })
  const finish = async (full: string) => {
    let usedIn = 0, usedOut = 0
    try { const fin = await stream.finalMessage(); usedIn = fin.usage?.input_tokens ?? 0; usedOut = fin.usage?.output_tokens ?? 0 } catch { /* ignore */ }
    void logUsage({ userId: id.userId, kind: 'bj_chat', model, inputTokens: usedIn, outputTokens: usedOut, credits: id.charged, meta: { api: 'v1', kind: id.kind, keyId: id.keyId } })
    if (full.trim()) void logTalk({ gameId: null, genre, situation, emotion, viewerText: message, utterance: full.trim(), exampleIds, ruleIds })
  }

  const wantStream = body?.stream === true || (req.headers.get('accept') ?? '').includes('text/plain')
  if (wantStream) {
    const enc = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let full = ''
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') { full += chunk.delta.text; controller.enqueue(enc.encode(chunk.delta.text)) }
          }
        } catch { if (!full) await refundApiCharge(id) }
        controller.close()
        if (full) await finish(full)
      },
    })
    return new Response(readable, { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'X-AJ-Name': encodeURIComponent(ajDisplayName(id)), 'X-AJ-Charged': String(id.charged), 'X-AJ-Quota': `${id.callsToday}/${id.dailyQuota}` } })
  }

  let full = ''
  try { const fin = await stream.finalMessage(); full = fin.content.map(c => (c.type === 'text' ? c.text : '')).join('') } catch { await refundApiCharge(id); return apiError(502, 'llm failed', { refunded: id.charged }) }
  await finish(full)
  return apiJson({ reply: full.trim(), name: ajDisplayName(id), quota: { today: id.callsToday, daily: id.dailyQuota }, charged: id.charged, balance: id.balance })
}
