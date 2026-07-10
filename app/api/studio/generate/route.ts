import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { GENERATION_COST } from '@/lib/studio/constants'
import { SYSTEM_PROMPT, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER } from '@/lib/studio/parse'

export const maxDuration = 300

export async function POST(req: Request) {
  const { projectId, prompt } = await req.json()
  if (!projectId || !prompt?.trim()) return new Response('bad request', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })

  // RLS로 본인 프로젝트만 조회됨 — 없으면 404
  const { data: project } = await supabase
    .from('studio_projects').select('id, title').eq('id', projectId).maybeSingle()
  if (!project) return new Response('not found', { status: 404 })

  // 크레딧 원자적 차감 — 실패 경로에서 이 ref로 환불
  const spendRef = `gen:${projectId}:${crypto.randomUUID()}`
  const { error: spendError } = await supabase.rpc('spend_credits', {
    p_amount: GENERATION_COST,
    p_ref: spendRef,
  } as never)
  if (spendError) {
    const insufficient = spendError.message.includes('INSUFFICIENT_CREDITS')
    return new Response(insufficient ? 'insufficient credits' : 'spend failed', {
      status: insufficient ? 402 : 500,
    })
  }

  const [latestRes, historyRes] = await Promise.all([
    supabase.from('studio_versions').select('html, version')
      .eq('project_id', projectId).order('version', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('studio_messages').select('role, content')
      .eq('project_id', projectId).order('created_at', { ascending: true }),
  ])
  const latest = latestRes.data as { html: string; version: number } | null
  const history = (historyRes.data ?? []) as ChatTurn[]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages: buildMessages({ prompt, currentHtml: latest?.html ?? null, history }),
  })

  const refund = () =>
    supabase.rpc('refund_credits', { p_amount: GENERATION_COST, p_ref: spendRef } as never)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        const parsed = parseGeneration(full)
        if (!parsed.html) {
          await refund()
          controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
        } else {
          const nextVersion = (latest?.version ?? 0) + 1
          const { error: vErr } = await supabase.from('studio_versions').insert([
            { project_id: projectId, version: nextVersion, html: parsed.html },
          ] as never)
          if (vErr) {
            await refund()
            controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
          } else {
            await supabase.from('studio_messages').insert([
              { project_id: projectId, role: 'user', content: prompt },
              { project_id: projectId, role: 'assistant', content: parsed.description },
            ] as never)
            if (nextVersion === 1) {
              const title = extractTitle(parsed.html)
              if (title) {
                await supabase.from('studio_projects')
                  .update({ title } as never).eq('id', projectId)
              }
            }
          }
        }
      } catch {
        await refund()
        controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
