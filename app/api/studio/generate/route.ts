import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/log/server'
import { GENERATION_COST } from '@/lib/studio/constants'
import { SYSTEM_PROMPT, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER, OFF_TOPIC_MARKER } from '@/lib/studio/parse'
import { matchTemplate, templateOnly, extrasOf, TEMPLATES } from '@/lib/studio/templates'
import { matchTemplateIn } from '@/lib/studio/template-match'
import { loadDbTemplates, saveTemplateCandidate, bumpTemplateUse } from '@/lib/studio/db-templates'
import { hardenHtml } from '@/lib/studio/harden'
import { personalizeTemplate } from '@/lib/studio/personalize'
import { logUsage } from '@/lib/llm/usage'
import { GENERATION_MAX_TOKENS } from '@/lib/llm/pricing'
import { trackGeo } from '@/lib/geo/track'
import { route as routeModel } from '@/lib/llm/router'
import { loadPolicy } from '@/lib/tokenpilot/policy'
import { guardStatus } from '@/lib/tokenpilot/guard'

export const maxDuration = 300

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const { projectId, prompt, images: rawImages } = (body ?? {}) as { projectId?: unknown; prompt?: unknown; images?: unknown }
  // 첨부 이미지 — 최대 3장, jpeg/png/webp/gif, 각 5MB(base64 ~7M자) 이내
  const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const images = (Array.isArray(rawImages) ? rawImages : [])
    .filter((i): i is { media_type: string; data: string } =>
      !!i && typeof i.media_type === 'string' && ALLOWED_MEDIA.includes(i.media_type) &&
      typeof i.data === 'string' && i.data.length > 0 && i.data.length < 7_000_000)
    .slice(0, 3)

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
  // 관리자도 동일하게 크레딧 차감 (플랫폼 사용 = 과금 원칙). 원가 가드만 관리자 예외.
  const isAdminUser = profile?.role === 'admin'
  const chargeUser = true
  // TokenPilot 원가 가드 — 적자 구간이면 일반 사용자 생성 차단 (관리자는 통과)
  if (!isAdminUser) {
    try { const { stats } = await guardStatus(); if (stats.blocked) return new Response(`paused: ${stats.reason ?? ''}`, { status: 503 }) } catch { /* 가드 조회 실패는 생성 막지 않음 */ }
  }
  const parsedCost = Number((costRow as { value?: unknown } | null)?.value)
  const cost = Number.isFinite(parsedCost) && parsedCost >= 1 ? parsedCost : GENERATION_COST

  void trackGeo(req.headers, 'generate', user.id, projectId)

  // RLS로 본인 프로젝트만 조회됨 — 없으면 404
  const { data: project } = await supabase
    .from('studio_projects').select('id, title').eq('id', projectId).maybeSingle()
  if (!project) return new Response('not found', { status: 404 })

  // 컨텍스트(최신 버전·대화) 먼저 — 첫 생성이면 템플릿(기본 셋팅 게임)을 1차로 확인한다
  const [latestRes, historyRes] = await Promise.all([
    supabase.from('studio_versions').select('html, version')
      .eq('project_id', projectId).order('version', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('studio_messages').select('role, content')
      .eq('project_id', projectId).order('created_at', { ascending: true }),
  ])
  if (latestRes.error || historyRes.error) {
    console.error('[studio/generate] context fetch failed', latestRes.error, historyRes.error)
    return new Response('context fetch failed', { status: 500 })
  }
  const latest = latestRes.data as { html: string; version: number } | null
  const history = (historyRes.data ?? []) as ChatTurn[]

  // 크레딧 원자적 차감 — 실패 경로에서 이 ref로 환불 (관리자는 차감 없음)
  const spendRef = `gen:${projectId}:${crypto.randomUUID()}`
  if (chargeUser) {
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
    if (!chargeUser) return // 차감이 없었으니 환불도 없다
    const { error } = await createAdminClient().rpc('refund_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_ref: spendRef,
    } as never)
    if (error) console.error('[studio/generate] refund failed', error)
  }

  // ── 템플릿 엔진: 첫 생성이고 알려진 장르면 ──
  //   (a) 장르 이름뿐 → 템플릿을 그대로 1버전으로 저장 (LLM 호출 없음 — 크레딧은 동일하게 차감: 서비스 비용/유지)
  //   (b) 추가 요구가 있으면 → 템플릿을 베이스 HTML 로 두고 "수정" 만 생성 (from-scratch 보다 저렴)
  // 정적 템플릿 + 관리자 승인 DB 템플릿(처음 만들어진 게임들) 모두 매칭 대상
  const tmatch = !latest && images.length === 0 ? (matchTemplate(prompt) ?? matchTemplateIn(await loadDbTemplates(), prompt)) : null
  if (tmatch && !TEMPLATES.includes(tmatch.template)) void bumpTemplateUse(tmatch.template.slug)
  let baseHtml: string | null = latest?.html ?? null
  let effectivePrompt = prompt
  let templateNote = ''
  if (tmatch) {
    if (templateOnly(prompt, tmatch.keyword)) {
      // 회원·프로젝트마다 제목/색조를 다르게 (LLM 없이) — 같은 템플릿이라도 다른 게임처럼
      const { html, title: pTitle } = personalizeTemplate(tmatch.template.slug, tmatch.template.html, `${user.id}:${projectId}`)
      const { error: vErr } = await supabase.from('studio_versions').insert([
        { project_id: projectId, version: 1, html },
      ] as never)
      if (vErr) { await refund(); return new Response('save failed', { status: 500 }) }
      // 실제 생성처럼 보이게: 설명을 문장 단위로, HTML 을 조각으로 천천히 스트리밍하고, 토큰 사용량은 실측 대신 추정치로 표시
      const desc = tmatch.template.description
        ? `「${pTitle || tmatch.template.name}」 을(를) 만들었어요. ${tmatch.template.description} 이어서 "배경을 우주로", "속도를 더 빠르게" 처럼 말하면 그 위에 바꿔 드릴게요.`
        : `요청하신 「${pTitle || tmatch.template.name}」 게임을 만들었어요. 이어서 원하는 변경을 말씀해 주시면 바로 반영할게요.`
      await supabase.from('studio_messages').insert([
        { project_id: projectId, role: 'user', content: prompt },
        { project_id: projectId, role: 'assistant', content: desc },
      ] as never)
      const title = extractTitle(html)
      if (title) await supabase.from('studio_projects').update({ title } as never).eq('id', projectId)
      const { data: vrow } = await supabase.from('studio_versions').select('id').eq('project_id', projectId).eq('version', 1).maybeSingle()
      await logUsage({ userId: user.id, projectId, versionId: (vrow as { id: string } | null)?.id ?? null, kind: 'template', model: 'none', credits: chargeUser ? cost : 0, templateSlug: tmatch.template.slug })
      const estIn = 1400 + Math.round(prompt.length / 2)
      const estOut = Math.round(html.length / 3.6) + Math.round(desc.length / 2)
      const enc = new TextEncoder()
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
      const stream = new ReadableStream({
        async start(controller) {
          // 실제 생성처럼 — 생각하는 시간(1~1.7초) → 설명 타이핑(~2초) → 코드를 7.5~11초에 걸쳐 스트리밍 (총 10~15초)
          await sleep(1000 + Math.random() * 700)
          const words = desc.split(/(?<=\s)/)
          for (const w of words) { controller.enqueue(enc.encode(w)); await sleep(30 + Math.random() * 45) }
          await sleep(600)
          controller.enqueue(enc.encode('\n<game>'))
          const totalMs = 7500 + Math.random() * 3500
          const CH = 180
          const chunks = Math.ceil(html.length / CH)
          const per = totalMs / chunks
          // 빠르게 쏟아지는 버스트(5조각 연속) + 짧은 생각 정지 — 총 시간은 동일하게
          let k = 0
          for (let i = 0; i < html.length; i += CH) {
            controller.enqueue(enc.encode(html.slice(i, i + CH)))
            k++
            if (k % 5 === 0) await sleep(per * 5 * (0.9 + Math.random() * 0.4))
            else await sleep(8 + Math.random() * 12)
          }
          controller.enqueue(enc.encode('</game>\n'))
          controller.enqueue(enc.encode(`[[USAGE:${estIn}:${estOut}]]`))
          controller.close()
        },
      })
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    baseHtml = personalizeTemplate(tmatch.template.slug, tmatch.template.html, `${user.id}:${projectId}`).html
    const extras = extrasOf(prompt, tmatch.keyword)
    effectivePrompt = `이 게임은 「${tmatch.template.name}」 이야. 반드시 이 장르와 핵심 규칙(조작·목표·진행)을 그대로 유지한 채, 아래 요구만 반영해 수정한 전체 완성본을 만들어줘. 다른 장르의 게임으로 바꾸거나 처음부터 새로 만들지 마. 요구: ${extras || prompt}`
    templateNote = `「${tmatch.template.name}」 게임을 만들면서 요청하신 내용을 함께 반영했어요. `
  }

  // 차감은 이미 성공했다 — 여기서 동기적으로 던지면(예: ANTHROPIC_API_KEY 누락)
  // 환불 없이 크레딧만 사라지므로 반드시 감싼다.
  // TokenPilot 라우팅 — 작업 종류·크기에 따라 모델 선택 (기본: Sonnet 5)
  const routeTask = tmatch ? 'template_edit' : latest ? 'edit' : 'create'
  const routed = routeModel({ task: routeTask, promptChars: prompt.length, htmlChars: baseHtml?.length ?? 0 }, await loadPolicy())
  const chosenModel = images.length > 0 ? 'claude-sonnet-5' : routed.model  // 이미지 입력은 Sonnet 고정
  let stream: ReturnType<Anthropic['messages']['stream']>
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    stream = client.messages.stream({
      model: chosenModel,
      max_tokens: GENERATION_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: buildMessages({ prompt: effectivePrompt, currentHtml: baseHtml, history, images }) as never,
    })
  } catch (e) {
    await refund()
    console.error('[studio/generate]', e)
    void logServerError('api', e, { path: '/api/studio/generate' })
    return new Response('generation failed', { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      let versionPersisted = false
      try {
        if (templateNote) { full += templateNote; controller.enqueue(encoder.encode(templateNote)) }
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        // 실제 토큰 사용량을 마커로 전달 — 클라이언트가 파싱해 표시하고 본문에선 제외
        let usedIn = 0, usedOut = 0
        try {
          const fin = await stream.finalMessage()
          usedIn = fin.usage?.input_tokens ?? 0; usedOut = fin.usage?.output_tokens ?? 0
          controller.enqueue(encoder.encode(`\n[[USAGE:${usedIn}:${usedOut}]]`))
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
          const { data: vIns, error: vErr } = await supabase.from('studio_versions').insert([
            { project_id: projectId, version: nextVersion, html: hardenHtml(parsed.html) },
          ] as never).select('id').maybeSingle()
          if (vErr) {
            await refund()
            controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
          } else {
            // 버전이 저장된 이상 생성은 성공이다 — 이후 실패는 환불도, 에러 마커도 없다.
            versionPersisted = true
            await logUsage({
              userId: user.id, projectId, versionId: (vIns as { id: string } | null)?.id ?? null,
              kind: tmatch ? 'template_edit' : latest ? 'edit' : 'create',
              model: chosenModel, inputTokens: usedIn, outputTokens: usedOut, credits: chargeUser ? cost : 0,
              templateSlug: tmatch?.template.slug ?? null,
            })
            try {
              const { error: mErr } = await supabase.from('studio_messages').insert([
                { project_id: projectId, role: 'user', content: prompt },
                { project_id: projectId, role: 'assistant', content: parsed.description },
              ] as never)
              if (mErr) console.error('[studio/generate] messages insert failed', mErr)
              if (nextVersion === 1 && !tmatch && images.length === 0) {
                // 처음 만들어진 게임 → 템플릿 후보로 저장 (관리자 승인 후 재사용 → 다음부턴 LLM 비용 0)
                void saveTemplateCandidate({ prompt, title: extractTitle(parsed.html), description: parsed.description, html: hardenHtml(parsed.html), projectId, userId: user.id })
              }
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
              void logServerError('api', postErr, { path: '/api/studio/generate' })
            }
          }
        }
      } catch (err) {
        if (!versionPersisted) {
          await refund()
          controller.enqueue(encoder.encode(GEN_ERROR_MARKER))
        } else {
          console.error('[studio/generate] error after version persisted', err)
          void logServerError('api', err, { path: '/api/studio/generate' })
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
