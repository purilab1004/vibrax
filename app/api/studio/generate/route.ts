import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GENERATION_COST } from '@/lib/studio/constants'
import { SYSTEM_PROMPT, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER, OFF_TOPIC_MARKER } from '@/lib/studio/parse'

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

  // 밴 유저 차단 + 생성 비용을 설정에서 읽기 (실패 시 GENERATION_COST 폴백)
  const [{ data: profileRow }, { data: costRow }] = await Promise.all([
    supabase.from('profiles').select('banned_at, role').eq('id', user.id).maybeSingle(),
    supabase.from('site_settings').select('value').eq('key', 'generation_cost').maybeSingle(),
  ])
  const profile = profileRow as { banned_at?: string | null; role?: string } | null
  if (profile?.banned_at) {
    return new Response('banned', { status: 403 })
  }
  // 관리자는 크레딧 없이 생성 가능 (운영·테스트 용도)
  const isAdminUser = profile?.role === 'admin'
  const parsedCost = Number((costRow as { value?: unknown } | null)?.value)
  const cost = Number.isFinite(parsedCost) && parsedCost >= 1 ? parsedCost : GENERATION_COST

  // RLS로 본인 프로젝트만 조회됨 — 없으면 404
  const { data: project } = await supabase
    .from('studio_projects').select('id, title').eq('id', projectId).maybeSingle()
  if (!project) return new Response('not found', { status: 404 })

  // 크레딧 원자적 차감 — 실패 경로에서 이 ref로 환불 (관리자는 차감 없음)
  const spendRef = `gen:${projectId}:${crypto.randomUUID()}`
  if (!isAdminUser) {
    const { error: spendError } = await supabase.rpc('spend_credits', {
      p_amount: cost,
      p_ref: spendRef,
    } as never)
    if (spendError) {
      const insufficient = spendError.message.includes('INSUFFICIENT_CREDITS')
      return new Response(insufficient ? 'insufficient credits' : 'spend failed', {
        status: insufficient ? 402 : 500,
      })
    }
  }

  // refund_credits는 service role 전용(자기 자신 대상이라도 클라이언트에서
  // 직접 RPC를 호출해 성공 건을 임의로 환불하는 것을 막기 위함) — admin
  // 클라이언트로 호출하고, 검증된 user.id를 p_user_id로 넘긴다.
  const refund = async () => {
    if (isAdminUser) return // 차감이 없었으니 환불도 없다
    const { error } = await createAdminClient().rpc('refund_credits', {
      p_user_id: user.id,
      p_amount: cost,
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
        // 실제 토큰 사용량을 마커로 전달 — 클라이언트가 파싱해 표시하고 본문에선 제외
        try {
          const fin = await stream.finalMessage()
          controller.enqueue(encoder.encode(
            `\n[[USAGE:${fin.usage?.input_tokens ?? 0}:${fin.usage?.output_tokens ?? 0}]]`,
          ))
        } catch { /* usage 실패는 무시 — 생성 자체엔 영향 없음 */ }
        const parsed = parseGeneration(full)
        if (!parsed.html) {
          await refund()
          // 게임과 무관한 요청 — 실패가 아니라 안내로 처리 (크레딧은 위에서 환불됨)
          controller.enqueue(encoder.encode(
            full.includes('<offtopic') ? OFF_TOPIC_MARKER : GEN_ERROR_MARKER,
          ))
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
