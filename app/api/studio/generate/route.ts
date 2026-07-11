import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GENERATION_COST } from '@/lib/studio/constants'
import { SYSTEM_PROMPT, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER } from '@/lib/studio/parse'

export const maxDuration = 300

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const { projectId, prompt } = (body ?? {}) as { projectId?: unknown; prompt?: unknown }
  if (typeof projectId !== 'string' || typeof prompt !== 'string' || !projectId || !prompt.trim()) {
    return new Response('bad request', { status: 400 })
  }

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

  // refund_credits는 service role 전용(자기 자신 대상이라도 클라이언트에서
  // 직접 RPC를 호출해 성공 건을 임의로 환불하는 것을 막기 위함) — admin
  // 클라이언트로 호출하고, 검증된 user.id를 p_user_id로 넘긴다.
  const refund = async () => {
    const { error } = await createAdminClient().rpc('refund_credits', {
      p_user_id: user.id,
      p_amount: GENERATION_COST,
      p_ref: spendRef,
    } as never)
    if (error) console.error('[studio/generate] refund failed', error)
  }

  const [latestRes, historyRes] = await Promise.all([
    supabase.from('studio_versions').select('html, version')
      .eq('project_id', projectId).order('version', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('studio_messages').select('role, content')
      .eq('project_id', projectId).order('created_at', { ascending: true }),
  ])
  if (latestRes.error || historyRes.error) {
    console.error('[studio/generate] context fetch failed', latestRes.error, historyRes.error)
    await refund()
    return new Response('context fetch failed', { status: 500 })
  }
  const latest = latestRes.data as { html: string; version: number } | null
  const history = (historyRes.data ?? []) as ChatTurn[]

  // 차감은 이미 성공했다 — 여기서 동기적으로 던지면(예: ANTHROPIC_API_KEY 누락)
  // 환불 없이 크레딧만 사라지므로 반드시 감싼다.
  let stream: ReturnType<Anthropic['messages']['stream']>
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages: buildMessages({ prompt, currentHtml: latest?.html ?? null, history }),
    })
  } catch (e) {
    await refund()
    console.error('[studio/generate]', e)
    return new Response('generation failed', { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      let versionPersisted = false
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
            // 버전이 저장된 이상 생성은 성공이다 — 이후 실패는 환불도, 에러 마커도 없다.
            versionPersisted = true
            try {
              const { error: mErr } = await supabase.from('studio_messages').insert([
                { project_id: projectId, role: 'user', content: prompt },
                { project_id: projectId, role: 'assistant', content: parsed.description },
              ] as never)
              if (mErr) console.error('[studio/generate] messages insert failed', mErr)
              if (nextVersion === 1) {
                const title = extractTitle(parsed.html)
                if (title) {
                  const { error: tErr } = await supabase.from('studio_projects')
                    .update({ title } as never).eq('id', projectId)
                  if (tErr) console.error('[studio/generate] title update failed', tErr)
                }
              }
            } catch (postErr) {
              console.error('[studio/generate] post-save step failed', postErr)
            }
          }
        }
      } catch (err) {
        if (!versionPersisted) {
          await refund()
          controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
        } else {
          console.error('[studio/generate] error after version persisted', err)
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
