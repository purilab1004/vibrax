import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/log/server'
import { GENERATION_COST } from '@/lib/studio/constants'
import { buildSystemPrompt, buildMessages, type ChatTurn } from '@/lib/studio/prompt'
import { parseGeneration, extractTitle, GEN_ERROR_MARKER, OFF_TOPIC_MARKER, ANSWER_MARKER } from '@/lib/studio/parse'
import { templateOnly, extrasOf } from '@/lib/studio/templates'
import { matchTemplateIn } from '@/lib/studio/template-match'
import { loadDbTemplates, saveTemplateCandidate, bumpTemplateUse } from '@/lib/studio/db-templates'
import { effectiveStaticTemplates } from '@/lib/studio/template-overrides'
import { rankTemplates } from '@/lib/studio/similarity'
import { loadMl, logMapping, learnKeyword } from '@/lib/studio/mlpilot'
import { aiJudgeTemplate } from '@/lib/studio/ai-judge'
import { loadAutomation, logAutomation } from '@/lib/automation'
import { hardenHtml, injectSounds, stripShims } from '@/lib/studio/harden'
import { tryMaxJob, type MsgStream } from '@/lib/studio/max-job'
import { extractPatches, applyPatches, validatePatchedHtml } from '@/lib/studio/patch'
import { stripAttach } from '@/lib/studio/attach'
import { buildAttachNote } from '@/lib/studio/attach-server'
import { loadControls } from '@/lib/controls-server'
import { extractAssetIds, stripAssets, injectAssets, assetPromptNote, scoreAssets, listAutoAssets, getAssetsByIds, loadAssetData, type MediaAssetLite } from '@/lib/media/assets'
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
  const { projectId, prompt, images: rawImages, sounds: rawSounds, variantSlug: rawVariantSlug, assetIds: rawAssetIds, engine: rawEngine } = (body ?? {}) as { projectId?: unknown; prompt?: unknown; images?: unknown; sounds?: unknown; variantSlug?: unknown; assetIds?: unknown; engine?: unknown }
  // 관리자 엔진 선택 — max-opus / max-fable(로컬 Max 워커), api(API 토큰). 일반 회원은 무시
  const engine = rawEngine === 'api' || rawEngine === 'max-fable' || rawEngine === 'max-opus' ? rawEngine : 'max-opus'
  // 미디어 라이브러리 에셋 (스튜디오에서 고른 것) — 최대 10개
  const assetIds = (Array.isArray(rawAssetIds) ? rawAssetIds : []).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 10)
  const variantSlug = typeof rawVariantSlug === 'string' ? rawVariantSlug : null
  // 첨부 이미지 — 최대 3장, jpeg/png/webp/gif, 각 5MB(base64 ~7M자) 이내
  const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const images = (Array.isArray(rawImages) ? rawImages : [])
    .filter((i): i is { media_type: string; data: string } =>
      !!i && typeof i.media_type === 'string' && ALLOWED_MEDIA.includes(i.media_type) &&
      typeof i.data === 'string' && i.data.length > 0 && i.data.length < 7_000_000)
    .slice(0, 3)
  // 첨부 사운드 — 최대 2개, mp3/wav/ogg/m4a, 각 2MB(base64 ~2.7M자). LLM 엔 이름·역할만 전달하고 데이터는 게임 HTML 에 주입.
  const ALLOWED_AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm']
  const sounds = (Array.isArray(rawSounds) ? rawSounds : [])
    .filter((x): x is { name: string; media_type: string; data: string; role?: string } =>
      !!x && typeof x.name === 'string' && typeof x.media_type === 'string' && ALLOWED_AUDIO.includes(x.media_type) &&
      typeof x.data === 'string' && x.data.length > 0 && x.data.length < 2_800_000)
    .slice(0, 2)
    .map(x => ({ name: String(x.name).slice(0, 60), media_type: x.media_type, data: x.data, role: typeof (x as { role?: string }).role === 'string' ? String((x as { role?: string }).role).slice(0, 20) : '' }))
  const hasAttach = images.length > 0 || sounds.length > 0
  // 채팅에 남길 첨부 표시(이미지 썸네일·사운드 이름) — 메시지 content 끝에 마커로 저장
  const attachNote = hasAttach ? await buildAttachNote(images, sounds).catch(() => '') : ''

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
  const history = ((historyRes.data ?? []) as ChatTurn[]).map(t => ({ ...t, content: stripAttach(t.content ?? '') }))  // 첨부 마커는 모델에 보내지 않는다

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
  // 미디어 에셋 사용 크레딧(아이템당, 관리자 설정) — 이번 생성에 새로 들어가는 에셋만 별도 차감. 실패 시 함께 환불, 성공 시 100% 디자이너 적립
  let assetCost = 0
  let assetCostRows: { id: string; credit_cost: number; designer_id: string | null; credit_earned: number }[] = []
  const refund = async () => {
    if (!chargeUser) return // 차감이 없었으니 환불도 없다
    const adminDb = createAdminClient()
    const { error } = await adminDb.rpc('refund_credits', { p_user_id: user.id, p_amount: cost, p_ref: spendRef } as never)
    if (error) console.error('[studio/generate] refund failed', error)
    if (assetCost > 0) { const { error: e2 } = await adminDb.rpc('refund_credits', { p_user_id: user.id, p_amount: assetCost, p_ref: spendRef + ':assets' } as never); if (e2) console.error('[studio/generate] asset refund failed', e2) }
  }

  // ── 템플릿 엔진: 첫 생성이고 알려진 장르면 ──
  //   (a) 장르 이름뿐 → 템플릿을 그대로 1버전으로 저장 (LLM 호출 없음 — 크레딧은 동일하게 차감: 서비스 비용/유지)
  //   (b) 추가 요구가 있으면 → 템플릿을 베이스 HTML 로 두고 "수정" 만 생성 (from-scratch 보다 저렴)
  // 정적 템플릿 + 관리자 승인 DB 템플릿(처음 만들어진 게임들) 모두 매칭 대상
  const staticList = await effectiveStaticTemplates()
  const auto = await loadAutomation()
  const dbList = !hasAttach ? await loadDbTemplates() : []
  let tmatch = !hasAttach ? (matchTemplateIn(staticList, prompt) ?? matchTemplateIn(dbList, prompt)) : null
  // 이미 게임이 있는 프로젝트에서도 "로그라이크 던전 만들어줘" 처럼 장르 이름뿐인 새 게임 요청이면 템플릿을 다음 버전으로 그대로 불러온다(LLM 0).
  // 반면 "테트리스처럼 블록이 떨어지게 해줘" 같은 수정 요청(추가 문장 있음)은 기존 게임 수정 경로를 유지한다.
  if (latest && tmatch && !templateOnly(prompt, tmatch.keyword, tmatch.template.keywords)) tmatch = null
  // 조작 변형 선택: 사용자가 조작 카드로 특정 변형을 골랐으면 그 템플릿을 강제 사용 (매칭 무시)
  if (variantSlug && !latest && !hasAttach) {
    const vt = staticList.find(t => t.slug === variantSlug) ?? dbList.find(t => t.slug === variantSlug)
    if (vt) tmatch = { template: vt, keyword: vt.keywords[0] ?? vt.name }
  }
  let mapMethod: 'keyword' | 'similarity' | 'ml' | 'none' = tmatch ? 'keyword' : 'none'
  let mapConf: number | null = tmatch ? 1 : null
  // MLPilot: 키워드로 못 잡으면 유사도 매퍼(문자 n-gram, LLM 없음)로 가장 가까운 템플릿을 고른다
  if (!tmatch && !latest && !hasAttach) {
    const ml = await loadMl()
    ml.aiJudge = ml.aiJudge && auto['mlpilot.aiJudge']; ml.autoLearn = ml.autoLearn && auto['mlpilot.autoLearn']
    if (ml.enabled) {
      const all = [...staticList, ...dbList]
      const ranked = rankTemplates(prompt, all.map(t => ({ slug: t.slug, text: `${t.name} ${t.keywords.join(' ')} ${t.prompt} ${t.description}` })))
      const top = ranked[0]
      if (top && top.score >= ml.threshold) { const t = all.find(x => x.slug === top.slug)!; tmatch = { template: t, keyword: t.keywords[0] ?? t.name }; mapMethod = 'similarity'; mapConf = top.score }
      else if (top) mapConf = top.score
      // AI 자동 판단(Haiku 분류, 초저가) — 유사도로도 못 잡았을 때만
      if (!tmatch && ml.aiJudge) {
        const j = await aiJudgeTemplate(prompt, all.map(t => ({ slug: t.slug, name: t.name, keywords: t.keywords })), user.id, projectId)
        if (j.slug && j.confidence >= 0.7) {
          const t = all.find(x => x.slug === j.slug)!; tmatch = { template: t, keyword: t.keywords[0] ?? t.name }; mapMethod = 'ml'; mapConf = j.confidence
          if (ml.autoLearn && j.keyword) { void learnKeyword(t.slug, j.keyword); void logAutomation({ module: 'mlpilot', action: '키워드 자동 학습', target: t.slug, detail: { keyword: j.keyword, prompt: prompt.slice(0, 120) } }) }
          void logAutomation({ module: 'mlpilot', action: 'AI 자동 판단 매핑', target: t.slug, detail: { confidence: j.confidence, prompt: prompt.slice(0, 120) } })
        }
      }
      // 유사도 매핑이 확신도 높으면 프롬프트 핵심 토큰을 키워드로 자동 학습
      if (tmatch && mapMethod === 'similarity' && ml.autoLearn && (mapConf ?? 0) >= ml.threshold + 0.15) {
        const { extractKeywords } = await import('@/lib/studio/db-templates'); const k = extractKeywords(prompt)[0]; if (k) { void learnKeyword(tmatch.template.slug, k); void logAutomation({ module: 'mlpilot', action: '유사도 매핑 키워드 학습', target: tmatch.template.slug, detail: { keyword: k } }) }
      }
    }
  }
  if (tmatch && !staticList.includes(tmatch.template)) void bumpTemplateUse(tmatch.template.slug)
  void logMapping({ userId: user.id, projectId, prompt, templateSlug: tmatch?.template.slug ?? null, method: mapMethod, confidence: mapConf, usedLlm: !(tmatch && (mapMethod === 'similarity' || mapMethod === 'ml' || templateOnly(prompt, tmatch.keyword, tmatch.template.keywords))) })
  let baseHtml: string | null = latest?.html ?? null
  let effectivePrompt = prompt
  // 첨부 사운드 — 이름·역할만 프롬프트로 (데이터는 HTML 주입). LLM 이 적절한 상황에 재생 코드를 넣게 한다.
  if (sounds.length > 0) {
    const list = sounds.map(x => `"${x.name}"${x.role ? `(${x.role})` : ''}`).join(', ')
    effectivePrompt += `\n\n[첨부 사운드] 사용자가 오디오를 첨부했다: ${list}. 이 사운드들은 window.VIBREX_SOUNDS['파일이름'] 로 재생 가능하고, window.playSound('파일이름', {loop:true}) 헬퍼도 있다(이미 주입됨, 직접 정의하지 말 것). 역할/이름에 맞는 상황에 재생 코드를 넣어라 — 예: 배경음은 게임 시작 시 window.playSound('${sounds[0].name}', {loop:true, volume:0.5}), 점프/획득/타격/게임오버 효과음은 해당 이벤트에서 window.playSound(...). 첫 사용자 입력(키/탭) 이후에 재생을 시작해 브라우저 자동재생 정책을 지킨다.`
  }
  let templateNote = ''
  if (tmatch) {
    if (mapMethod === 'similarity' || mapMethod === 'ml' || templateOnly(prompt, tmatch.keyword, tmatch.template.keywords)) {
      // 회원·프로젝트마다 제목/색조를 다르게 (LLM 없이) — 같은 템플릿이라도 다른 게임처럼
      const personalized = personalizeTemplate(tmatch.template.slug, tmatch.template.html, `${user.id}:${projectId}`)
      let html = personalized.html; const pTitle = personalized.title
      // 미디어 라이브러리 — 이 템플릿(장르)에 등록된 자동 사용 에셋(배경·캐릭터 등)을 템플릿 경로에서도 주입 (예: 우빈 롤러코스터의 background_basic)
      try {
        const adminDb = createAdminClient()
        const pool = await listAutoAssets(adminDb)
        const picked = scoreAssets(pool, { prompt, genreSlugs: [tmatch.template.slug, ...(tmatch.template.genreGroup ? [tmatch.template.genreGroup] : [])] })
        // 템플릿 코드가 이름으로 직접 쓰는 에셋(예: 우빈 롤러코스터의 background_basic)은 프롬프트 언급과 무관하게 항상 주입
        for (const a of pool) if (!picked.some(x => x.id === a.id) && (html.includes(`'${a.name}'`) || html.includes(`"${a.name}"`))) picked.push(a)
        if (picked.length) { html = injectAssets(html, await loadAssetData(picked, { maxCount: 40 })); void adminDb.rpc('media_assets_touch', { ids: picked.map(a => a.id) }) }
      } catch (e) { console.error('[studio/generate] template asset inject failed', e) }
      const tplVersion = (latest?.version ?? 0) + 1
      const { error: vErr } = await supabase.from('studio_versions').insert([
        { project_id: projectId, version: tplVersion, html },
      ] as never)
      if (vErr) { await refund(); return new Response('save failed', { status: 500 }) }
      // 실제 생성처럼 보이게: 설명을 문장 단위로, HTML 을 조각으로 천천히 스트리밍하고, 토큰 사용량은 실측 대신 추정치로 표시
      const switched = latest ? '새 게임으로 바꿨어요(이전 버전은 버전 목록에 남아 있어요). ' : ''
      const desc = tmatch.template.description
        ? `${switched}「${pTitle || tmatch.template.name}」 을(를) 만들었어요. ${tmatch.template.description} 이어서 "배경을 우주로", "속도를 더 빠르게" 처럼 말하면 그 위에 바꿔 드릴게요.`
        : `${switched}요청하신 「${pTitle || tmatch.template.name}」 게임을 만들었어요. 이어서 원하는 변경을 말씀해 주시면 바로 반영할게요.`
      await supabase.from('studio_messages').insert([
        { project_id: projectId, role: 'user', content: prompt + attachNote },
        { project_id: projectId, role: 'assistant', content: desc },
      ] as never)
      const title = extractTitle(html)
      if (title) await supabase.from('studio_projects').update({ title } as never).eq('id', projectId)
      const { data: vrow } = await supabase.from('studio_versions').select('id').eq('project_id', projectId).eq('version', tplVersion).maybeSingle()
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
    const extras = extrasOf(prompt, tmatch.keyword, tmatch.template.keywords)
    effectivePrompt = `이 게임은 「${tmatch.template.name}」 이야. 반드시 이 장르와 핵심 규칙(조작·목표·진행)을 그대로 유지한 채, 아래 요구만 반영해 수정한 전체 완성본을 만들어줘. 다른 장르의 게임으로 바꾸거나 처음부터 새로 만들지 마. 요구: ${extras || prompt}`
    templateNote = `「${tmatch.template.name}」 게임을 만들면서 요청하신 내용을 함께 반영했어요. `
  }

  // ── 미디어 라이브러리 — 이전 버전에 주입돼 있던 에셋은 유지하고, 고른 것 + 프롬프트·장르에 맞는 것(auto_use)을 더한다. LLM 에는 base64 대신 이름·용도만 보낸다.
  const prevAssetIds = extractAssetIds(latest?.html)
  let mediaAssets: MediaAssetLite[] = []
  let pickedAssets: MediaAssetLite[] = []   // 사용자가 미디어 선택기에서 고른 에셋 — 채팅에 표시
  try {
    const adminDb = createAdminClient()
    const genreSlugs = tmatch ? [tmatch.template.slug, ...(tmatch.template.genreGroup ? [tmatch.template.genreGroup] : [])] : (variantSlug ? [variantSlug] : [])
    const [prevA, pickedA0, autoPool] = await Promise.all([
      getAssetsByIds(adminDb, prevAssetIds),
      getAssetsByIds(adminDb, assetIds),
      assetIds.length ? Promise.resolve([] as MediaAssetLite[]) : listAutoAssets(adminDb),
    ])
    const autoA = assetIds.length ? [] : scoreAssets(autoPool, { prompt, genreSlugs })
    const seen = new Set<string>()
    const pickedA = pickedA0; pickedAssets = pickedA
    for (const a of [...prevA, ...pickedA, ...autoA]) { if (!seen.has(a.id)) { seen.add(a.id); mediaAssets.push(a) } }
    mediaAssets = mediaAssets.slice(0, 10)
    const fresh = mediaAssets.filter(a => !prevAssetIds.includes(a.id)).map(a => a.id)
    if (fresh.length) void adminDb.rpc('media_assets_touch', { ids: fresh })
    // 아이템당 사용 크레딧 — 새로 들어가는 에셋의 credit_cost 합
    if (fresh.length) {
      try {
        const { data: rows } = await adminDb.from('media_assets').select('id,credit_cost,designer_id,credit_earned').in('id', fresh)
        assetCostRows = ((rows ?? []) as { id: string; credit_cost: number | null; designer_id: string | null; credit_earned: number | null }[]).map(r => ({ id: r.id, credit_cost: r.credit_cost ?? 0, designer_id: r.designer_id, credit_earned: r.credit_earned ?? 0 }))
        assetCost = assetCostRows.reduce((s, r) => s + (r.credit_cost > 0 ? r.credit_cost : 0), 0)
      } catch { assetCost = 0; assetCostRows = [] }
    }
  } catch (e) { console.error('[studio/generate] media pick failed', e); mediaAssets = [] }
  if (chargeUser && assetCost > 0) {
    const { error: assetSpendError } = await supabase.rpc('spend_credits', { p_amount: assetCost, p_ref: spendRef + ':assets' } as never)
    if (assetSpendError) {
      assetCost = 0
      await refund()
      const insufficient = assetSpendError.message.includes('INSUFFICIENT_CREDITS')
      return new Response(insufficient ? 'insufficient credits' : 'spend failed', { status: insufficient ? 402 : 500 })
    }
  }
  if (mediaAssets.length) {
    const titles: Record<string, { title: string; description: string | null }> = {}
    for (const a of mediaAssets) titles[a.name] = { title: a.title, description: a.description }
    effectivePrompt += assetPromptNote(mediaAssets.map(a => ({ name: a.name, kind: a.kind, width: a.width, height: a.height, meta: a.meta ?? {} })), titles)
  }
  // 차감은 이미 성공했다 — 여기서 동기적으로 던지면(예: ANTHROPIC_API_KEY 누락)
  // 환불 없이 크레딧만 사라지므로 반드시 감싼다.
  // TokenPilot 라우팅 — 작업 종류·크기에 따라 모델 선택 (기본: Sonnet 5)
  const routeTask = tmatch ? 'template_edit' : latest ? 'edit' : 'create'
  const routed = routeModel({ task: routeTask, promptChars: prompt.length, htmlChars: baseHtml?.length ?? 0 }, await loadPolicy())
  const chosenModel = images.length > 0 ? 'claude-sonnet-5' : routed.model  // 이미지 입력은 Sonnet 고정
  const systemPrompt = buildSystemPrompt(await loadControls())
  // 모델에는 에셋(base64)·플랫폼 shim 을 뺀 순수 게임 코드만 — 절반 이하 크기 (저장 시 다시 주입/하든)
  const modelBase = baseHtml ? stripShims(stripAssets(baseHtml)) : null
  const genMessages = buildMessages({ prompt: effectivePrompt, currentHtml: modelBase, history, images })
  let stream: MsgStream | null = null
  // 관리자 + MAX_WORKER=1: 로컬 Claude Code(Max 구독) 워커로 생성 (이미지 입력은 API). 워커가 없으면 API 로 폴백.
  const useMax = isAdminUser && process.env.MAX_WORKER === '1' && engine !== 'api'   // 이미지 첨부도 워커가 임시 파일로 넘겨 처리. 관리자가 'API 토큰'을 고르면 워커를 건너뛴다
  const maxModel = engine === 'max-fable' ? 'claude-fable-5-1' : 'claude-opus-5'
  if (useMax) {
    try { stream = await tryMaxJob(createAdminClient(), { projectId, userId: user.id, model: maxModel, system: systemPrompt, messages: genMessages }) } catch (e) { console.error('[studio/generate] max job', e); stream = null }
  }
  if (!stream) try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    stream = client.messages.stream({
      model: chosenModel,
      max_tokens: GENERATION_MAX_TOKENS,
      // Sonnet 5 는 기본으로 적응형 사고가 켜져 있고 그 토큰이 max_tokens 에 포함된다 — effort 로 사고 분량을 제한해 본문이 잘리지 않게
      ...(chosenModel.startsWith('claude-sonnet-5') || chosenModel.startsWith('claude-opus-5') ? { thinking: { type: 'adaptive' as const }, output_config: { effort: 'medium' as const } } : {}),
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],  // 시스템 프롬프트(수천 토큰) 캐시
      messages: genMessages as never,
    }) as unknown as MsgStream
  } catch (e) {
    await refund()
    console.error('[studio/generate]', e)
    void logServerError('api', e, { path: '/api/studio/generate' })
    return new Response('generation failed', { status: 500 })
  }

  const encoder = new TextEncoder()
  let aborted = false   // 클라이언트 연결 끊김 — 모델은 멈추지만, 이미 완성된 결과가 있으면 저장은 그대로 진행한다
  const readable = new ReadableStream({
    cancel() { aborted = true; try { stream?.abort?.() } catch { /* noop */ } },
    async start(controller) {
      let full = ''
      let versionPersisted = false
      const safeEnqueue = (t: string) => { if (aborted) return; try { controller.enqueue(encoder.encode(t)) } catch { aborted = true } }
      try {
        if (templateNote) { full += templateNote; safeEnqueue(templateNote) }
        // 부분 패치 모드: 모델이 <patch> 블록을 내기 시작하면 그 뒤 원문은 클라이언트에 보내지 않고(설명만 보임) 끝에 조립한 <game> 을 보낸다
        let raw = '', sentUpTo = 0, patchMode = false
        const forward = (final = false) => {
          if (patchMode) return
          const pi = raw.indexOf('<patch>')
          const upto = pi >= 0 ? pi : final ? raw.length : Math.max(sentUpTo, raw.length - 7)   // '<patch>' 가 잘려 오는 중일 수 있어 끝 7자는 보류
          if (pi >= 0) patchMode = true
          if (upto > sentUpTo) { const seg = raw.slice(sentUpTo, upto); sentUpTo = upto; full += seg; safeEnqueue(seg) }
        }
        for await (const chunk of stream) {
          if (aborted) break
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') { raw += chunk.delta.text ?? ''; forward() }
        }
        forward(true)
        // 연결이 끊겼어도(탭 이동·새로고침·프록시 종료) 완성본이 이미 나왔으면 저장은 끝까지 한다.
        // 건진 게 없을 때만 환불하고 끝낸다.
        if (aborted && !parseGeneration(full).html) { await refund(); console.log('[studio/generate] cancelled by user — nothing to save'); return }
        if (aborted) console.warn('[studio/generate] client gone, but generation complete → saving anyway')
        if (patchMode) {
          const ex = extractPatches(raw)
          const patchBase = modelBase
          const applied = patchBase && ex.blocks.length ? applyPatches(patchBase, ex.blocks) : null
          const invalid = applied && applied.failed.length === 0 ? validatePatchedHtml(applied.html) : null
          if (invalid) console.warn('[studio/generate] patched html invalid:', invalid)
          if (applied && applied.failed.length === 0 && !invalid) {
            const tail = `\n<game>${applied.html}</game>`
            full = ex.description + tail; safeEnqueue(tail)
            console.log('[studio/generate] patch mode', ex.blocks.length, 'blocks, out', raw.length, 'chars')
          } else {
            // 패치를 못 붙이면 전체 완성본으로 한 번 더 (API) — 느리지만 확실
            console.warn('[studio/generate] patch apply failed', applied?.failed ?? 'no base', invalid ?? '', '→ full regeneration')
            const retryMessages = [...(genMessages as { role: 'user' | 'assistant'; content: unknown }[]), { role: 'assistant', content: raw.slice(0, 4000) }, { role: 'user', content: '위 패치 중 원문이 일치하지 않거나 적용 결과가 깨지는 것이 있어 실패했다. 이번엔 패치 대신 요청을 반영한 "전체 완성본" HTML 을 <game>…</game> 으로 출력해라.' }]
            let retry: MsgStream | null = null
            if (useMax) { try { retry = await tryMaxJob(createAdminClient(), { projectId, userId: user.id, model: maxModel, system: systemPrompt, messages: retryMessages }) } catch { retry = null } }
            if (!retry) {
              const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
              retry = client.messages.stream({
                model: chosenModel, max_tokens: GENERATION_MAX_TOKENS,
                ...(chosenModel.startsWith('claude-sonnet-5') || chosenModel.startsWith('claude-opus-5') ? { thinking: { type: 'adaptive' as const }, output_config: { effort: 'medium' as const } } : {}),
                system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
                messages: retryMessages as never,
              }) as unknown as MsgStream
            }
            for await (const chunk of retry) {
              if (aborted) { try { retry.abort?.() } catch { /* noop */ } break }
              if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') { const t = chunk.delta.text ?? ''; full += t; safeEnqueue(t) }
            }
            if (aborted && !parseGeneration(full).html) { await refund(); return }
          }
        }
        // ── 출력이 잘렸으면 이어받는다 ──
        // 3D(three.js) 게임처럼 코드가 길면 max_tokens 에서 끊겨 </game> 이 안 온다.
        // 예전엔 이 경우 통째로 실패 처리돼 화면의 답변마저 새로고침하면 사라졌다 → 이어서 최대 2번 더 받아 완성한다.
        for (let cont = 0; cont < 2 && full.includes('<game>') && !full.includes('</game>'); cont++) {
          if (aborted) break
          console.warn('[studio/generate] output truncated → continue', cont + 1, 'chars so far', full.length)
          const prefill = full.replace(/\s+$/, '')   // 프리필은 끝에 공백이 있으면 API 가 거부한다
          const contMessages = [...(genMessages as { role: 'user' | 'assistant'; content: unknown }[]), { role: 'assistant', content: prefill }]
          let more: MsgStream | null = null
          if (useMax) { try { more = await tryMaxJob(createAdminClient(), { projectId, userId: user.id, model: maxModel, system: systemPrompt, messages: contMessages }) } catch { more = null } }
          if (!more) {
            const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
            // 이어받기에는 사고(thinking)를 끈다 — 프리필과 함께 쓸 수 없고, 남은 토큰을 본문에만 쓰기 위해서
            more = client.messages.stream({
              model: chosenModel, max_tokens: GENERATION_MAX_TOKENS,
              system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
              messages: contMessages as never,
            }) as unknown as MsgStream
          }
          for await (const chunk of more) {
            if (aborted) { try { more.abort?.() } catch { /* noop */ } break }
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') { const t = chunk.delta.text ?? ''; full += t; safeEnqueue(t) }
          }
        }
        // 그래도 닫는 태그가 없지만 HTML 은 끝났으면 살려 쓴다
        if (full.includes('<game>') && !full.includes('</game>') && /<\/html>/i.test(full)) {
          const end = full.toLowerCase().lastIndexOf('</html>') + '</html>'.length
          full = full.slice(0, end) + '</game>'
          safeEnqueue('</game>')
        }
        // 실제 토큰 사용량을 마커로 전달 — 클라이언트가 파싱해 표시하고 본문에선 제외
        let usedIn = 0, usedOut = 0
        try {
          const fin = await stream.finalMessage()
          usedIn = fin.usage?.input_tokens ?? 0; usedOut = fin.usage?.output_tokens ?? 0
          safeEnqueue(`\n[[USAGE:${usedIn}:${usedOut}]]`)
        } catch { /* usage 실패는 무시 — 생성 자체엔 영향 없음 */ }
        const parsed = parseGeneration(full)
        if (!parsed.html) {
          await refund()
          const answer = parsed.description.replace(/<patch>[\s\S]*$/, '').trim()
          if (full.includes('<offtopic')) {
            // 게임과 무관한 요청 — 실패가 아니라 안내로 처리 (크레딧은 위에서 환불됨)
            safeEnqueue(OFF_TOPIC_MARKER)
          } else if (latest && !patchMode && answer.length >= 20) {
            // 기존 게임에 대한 질문/진단에 설명만 한 경우 — 답변으로 보여 주고 대화에 남긴다 (버전 없음, 환불됨)
            try { await supabase.from('studio_messages').insert([{ project_id: projectId, role: 'user', content: prompt + attachNote }, { project_id: projectId, role: 'assistant', content: answer }] as never) } catch { /* noop */ }
            safeEnqueue(ANSWER_MARKER)
          } else {
            // 실패해도 대화는 남긴다 — 예전엔 새로고침하면 요청과 답변이 통째로 사라졌다
            const note = answer.length >= 10 ? answer : '만들다가 중간에 끊겼어요. 크레딧은 돌려드렸으니 한 번 더 시도해 주세요. (게임이 크면 "핵심만 먼저" 처럼 나눠서 요청하면 잘 됩니다)'
            try { await supabase.from('studio_messages').insert([{ project_id: projectId, role: 'user', content: prompt + attachNote }, { project_id: projectId, role: 'assistant', content: note }] as never) } catch { /* noop */ }
            safeEnqueue(GEN_ERROR_MARKER)
          }
        } else {
          const nextVersion = (latest?.version ?? 0) + 1
          const loadedAssets = mediaAssets.length ? await loadAssetData(mediaAssets) : []
          // 크기 제한 등으로 실리지 않은 에셋은 조용히 빠지지 않고 답변에 알린다 (예: 배경음 484KB > 상한)
          const skipped = mediaAssets.filter(a => !loadedAssets.some(l => l.id === a.id))
          const skipNote = skipped.length ? `\n\n⚠ 크기 제한으로 게임에 실리지 않은 에셋: ${skipped.map(a => `${a.name}(${Math.round(a.bytes / 1024)}KB)`).join(', ')}. 미디어 라이브러리에서 더 작은 파일(오디오 900KB·이미지 450KB 이하)로 바꿔 주세요.` : ''
          const { data: vIns, error: vErr } = await supabase.from('studio_versions').insert([
            { project_id: projectId, version: nextVersion, html: hardenHtml(injectAssets(injectSounds(parsed.html, sounds), loadedAssets), { controls: await loadControls() }) },
          ] as never).select('id').maybeSingle()
          if (vErr) {
            await refund()
            safeEnqueue(GEN_ERROR_MARKER)
          } else {
            // 버전이 저장된 이상 생성은 성공이다 — 이후 실패는 환불도, 에러 마커도 없다.
            versionPersisted = true
            // 디자이너 보상 — 이번 생성에 새로 실린 에셋의 '사용 크레딧'을 100% 그 디자이너에게 적립 (회원이 낸 assetCost 그대로)
            if (chargeUser && assetCost > 0) {
              try {
                const adminDb = createAdminClient()
                for (const r of assetCostRows) {
                  if (!r.designer_id || r.designer_id === user.id || r.credit_cost <= 0 || !loadedAssets.some(l => l.id === r.id)) continue
                  await adminDb.from('credit_ledger').insert([{ user_id: r.designer_id, amount: r.credit_cost, reason: 'designer_payout', ref_id: spendRef + ':assets' }] as never)
                  await adminDb.from('media_assets').update({ credit_earned: r.credit_earned + r.credit_cost }).eq('id', r.id)
                }
              } catch (e) { console.error('[studio/generate] designer payout failed', e) }
            }
            await logUsage({
              userId: user.id, projectId, versionId: (vIns as { id: string } | null)?.id ?? null,
              kind: tmatch ? 'template_edit' : latest ? 'edit' : 'create',
              model: chosenModel, inputTokens: usedIn, outputTokens: usedOut, credits: chargeUser ? cost : 0,
              templateSlug: tmatch?.template.slug ?? null,
            })
            try {
              const { error: mErr } = await supabase.from('studio_messages').insert([
                { project_id: projectId, role: 'user', content: prompt + (pickedAssets.length ? await buildAttachNote(images, sounds, pickedAssets.map(a => ({ name: a.name, kind: a.kind, url: a.url }))).catch(() => attachNote) : attachNote) },
                { project_id: projectId, role: 'assistant', content: parsed.description + skipNote },
              ] as never)
              if (mErr) console.error('[studio/generate] messages insert failed', mErr)
              if (nextVersion === 1 && !tmatch && !hasAttach) {
                // 처음 만들어진 게임 → 템플릿 후보로 저장 (관리자 승인 후 재사용 → 다음부턴 LLM 비용 0)
                void saveTemplateCandidate({ prompt, title: extractTitle(parsed.html), description: parsed.description, html: hardenHtml(parsed.html), projectId, userId: user.id, autoApprove: auto['templates.autoApprove'] })
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
          // Max 워커 오류(한도·추가 사용량 소진 등)는 사유를 그대로 보여 준다
          const m = err instanceof Error ? err.message : ''
          if (m.startsWith('max worker:')) controller.enqueue(encoder.encode(`\n[[GEN_MSG]]${m.replace(/^max worker:\s*/, '')}[[/GEN_MSG]]`))
          safeEnqueue(GEN_ERROR_MARKER)
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
