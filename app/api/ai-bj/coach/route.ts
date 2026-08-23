// AJ 플레이 코칭 — 내 AI 가 대신 플레이하는 동안 말로 가르치면, Haiku 가 게임 매니페스트(state 키·입력)를 보고
// 실행 가능한 정책 규칙 {cond, action, hold} 로 컴파일해 저장(버전업)하고 게임 봇에 전달한다. 세션이 바뀌어도 유지.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, tooMany, isSafeCond } from '@/lib/security/ratelimit'
import { curriculumForAsync } from '@/lib/studio/bot-curriculum'

interface Manifest { title?: string; goal?: string; clearCondition?: string; controls?: { input: string; action: string }[]; inputs?: string[]; stateKeys?: string[]; sample?: Record<string, unknown> }
interface Policy { version: number; tips: string[]; rules: { cond: string; action: string; hold?: number; why?: string }[]; params: Record<string, number>; summary: string | null }

export async function GET(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const gameId = new URL(req.url).searchParams.get('gameId')
  if (!gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data } = await createAdminClient().from('aj_play_policies').select('version,tips,rules,params,summary,best_score').eq('game_id', gameId).eq('user_id', user.id).maybeSingle()
  return Response.json({ policy: data ?? null })
}

export async function POST(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { gameId?: string; message?: string; manifest?: Manifest | null; genre?: string; gameTitle?: string; action?: 'coach' | 'episode' | 'demo' | 'learnFromDemo'; score?: number; cleared?: boolean; durationSec?: number; samples?: { s: Record<string, number>; k: string[] }[] } | null
  if (!b?.gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  if (b.action === 'episode') { if (!rateLimit(`ep:${user.id}`, 120, 3600_000).ok) return tooMany(); return await autoLearn(admin, user.id, b) }
  if (b.action === 'demo') { if (!rateLimit(`demo:${user.id}`, 120, 3600_000).ok) return tooMany(); return await saveDemo(admin, user.id, b.gameId, b.samples ?? []) }
  if (b.action === 'learnFromDemo') { if (!rateLimit(`coach:${user.id}`, 40, 3600_000).ok) return tooMany(); b.message = '내가 직접 플레이한 기록(데모 요약)을 보고, 내 플레이 스타일을 따라하는 규칙을 만들어줘.' }
  if (!b.message?.trim()) return Response.json({ error: 'bad request' }, { status: 400 })
  if (b.message.length > 500) return Response.json({ error: '너무 길어요 (500자 이내)' }, { status: 400 })
  if (!rateLimit(`coach:${user.id}`, 40, 3600_000).ok) return tooMany()
  const { data: cur } = await admin.from('aj_play_policies').select('*').eq('game_id', b.gameId).eq('user_id', user.id).maybeSingle()
  const prev = cur as (Policy & { id: string; best_score: number | null }) | null
  const m = b.manifest ?? {}
  const stateKeys = (m.stateKeys ?? (m.sample ? Object.keys(m.sample) : [])).slice(0, 40)
  const inputs = (m.inputs ?? ['left', 'right', 'up', 'down', 'action']).slice(0, 12)
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'no api key' }, { status: 500 })
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const sys = `너는 게임 봇 코치 컴파일러다. 사용자가 AI 플레이어에게 말로 가르친 조언을, 게임의 상태 키와 입력으로 실행 가능한 정책으로 바꾼다.
게임: ${b.gameTitle ?? ''} (${b.genre ?? ''}) / 목표: ${m.goal ?? '-'} / 클리어: ${m.clearCondition ?? '-'}
조작: ${(m.controls ?? []).map(c => `${c.input}=${c.action}`).join(', ') || '-'}
사용 가능한 입력(action): ${inputs.join(', ')}  (봇은 action 을 hold ms 동안 누른다)
state() 키: ${stateKeys.join(', ') || '(없음 — 규칙은 만들지 말고 params 와 tips 만)'}  예시 값: ${m.sample ? JSON.stringify(m.sample).slice(0, 400) : '-'}
현재 정책: ${prev ? JSON.stringify({ rules: prev.rules, params: prev.params, tips: prev.tips }).slice(0, 1500) : '없음'}
${demoSummary((prev as unknown as { demos?: Demo[] } | null)?.demos)}
출력 JSON 한 개만: {"rules":[{"cond":"s.ballX > s.paddleX + 8","action":"right","hold":80,"why":"공 따라가기"}],"params":{"reactionMs":60,"randomness":0.05},"tips":["사용자 조언 요약"],"summary":"AJ 가 사용자에게 하는 한 문장 답(반말, 10~25자, 무엇을 배웠는지)"}
규칙: cond 는 변수 s(state 객체)만 쓰는 JS 불리언 식, 위에서 아래로 첫 참인 규칙을 실행. 기존 규칙을 유지·수정하며 조언을 반영한다(최대 12개). state 키가 없으면 rules 는 빈 배열. 위험한 코드·함수 호출 금지.`
  let out: Policy
  try {
    const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1200, system: sys, messages: [{ role: 'user', content: b.message.trim() }] })
    const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as Partial<Policy>
    const rules = (Array.isArray(j.rules) ? j.rules : []).filter(r => r && typeof r.cond === 'string' && typeof r.action === 'string' && isSafeCond(r.cond) && inputs.includes(r.action)).slice(0, 12).map(r => ({ cond: r.cond.slice(0, 200), action: r.action, hold: Math.max(30, Math.min(1500, Number(r.hold ?? 100))), why: String(r.why ?? '').slice(0, 80) }))
    const params: Record<string, number> = {}; for (const [k, v] of Object.entries(j.params ?? {})) if (/^\w{1,24}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) params[k] = v
    out = { version: (prev?.version ?? 0) + 1, tips: [...(prev?.tips ?? []), ...(Array.isArray(j.tips) ? j.tips.map(String) : [b.message.trim()])].slice(-30), rules, params, summary: typeof j.summary === 'string' ? j.summary.slice(0, 120) : '알았어, 반영했어!' }
  } catch (e) { return Response.json({ error: `coach failed: ${(e as Error).message}` }, { status: 500 }) }
  const row = { game_id: b.gameId, user_id: user.id, version: out.version, tips: out.tips, rules: out.rules, params: out.params, summary: out.summary, updated_at: new Date().toISOString() }
  const { error } = prev ? await admin.from('aj_play_policies').update(row as never).eq('id', prev.id) : await admin.from('aj_play_policies').insert([row] as never)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  void logLearn(admin, user.id, b.gameId, b.action === 'learnFromDemo' ? 'demo' : 'coach', b.action === 'learnFromDemo' ? '내 플레이(데모)로 학습' : `코칭: ${b.message!.trim().slice(0, 60)}`, out.summary ?? '', out.version)
  return Response.json({ ok: true, policy: out })
}

export async function PATCH(req: Request) {
  // 최고 점수 갱신 (학습 효과 추적)
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { gameId?: string; score?: number } | null
  if (!b?.gameId || typeof b.score !== 'number') return Response.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('aj_play_policies').select('id,best_score,version').eq('game_id', b.gameId).eq('user_id', user.id).maybeSingle()
  const cur = data as { id: string; best_score: number | null; version: number } | null
  if (cur && (cur.best_score ?? -1) < b.score) {
    const prevBest = cur.best_score ?? null
    await admin.from('aj_play_policies').update({ best_score: b.score, best_score_at: new Date().toISOString() } as never).eq('id', cur.id)
    void logLearn(admin, user.id, b.gameId, 'record', `최고 점수 갱신 — ${b.score.toLocaleString()}점`, prevBest != null ? `이전 최고 ${prevBest.toLocaleString()}점 → ${b.score.toLocaleString()}점` : `첫 기록 ${b.score.toLocaleString()}점`, cur.version)
  }
  return Response.json({ ok: true, best: Math.max(cur?.best_score ?? 0, b.score) })
}

// ── 자동 학습 ──────────────────────────────────────────────────────────────────
// 오토파일럿이 한 판 끝낼 때마다 에피소드(점수·시간·클리어)를 기록. 같은 버전으로 3판이 쌓이면
//  1) 현재 버전 평균이 역대 최고(best_avg)보다 낮으면 → 최고 규칙으로 되돌리고(회귀 방지)
//  2) 아니면 Haiku 에게 "이 규칙으로 평균 X점, 상태 키는 이것, 더 잘하려면?" 을 물어 새 버전 생성(자기 반성 학습)
type Ep = { v: number; score: number; sec: number; cleared: boolean; t: string }
async function autoLearn(admin: ReturnType<typeof createAdminClient>, userId: string, b: { gameId?: string; manifest?: Manifest | null; genre?: string; gameTitle?: string; score?: number; cleared?: boolean; durationSec?: number }) {
  const gameId = b.gameId!
  const { data } = await admin.from('aj_play_policies').select('*').eq('game_id', gameId).eq('user_id', userId).maybeSingle()
  let row = data as (Policy & { id: string; episodes: Ep[]; auto_learn: boolean; best_rules: Policy['rules'] | null; best_avg: number | null; auto_count: number; best_score: number | null }) | null
  if (!row) {
    const { data: ins } = await admin.from('aj_play_policies').insert([{ game_id: gameId, user_id: userId, version: 1, tips: [], rules: [], params: {}, summary: null }] as never).select('*').maybeSingle()
    row = ins as typeof row
    if (!row) return Response.json({ ok: false })
  }
  const score = typeof b.score === 'number' ? b.score : 0
  const eps: Ep[] = [...(Array.isArray(row.episodes) ? row.episodes : []), { v: row.version, score, sec: Math.round(b.durationSec ?? 0), cleared: !!b.cleared, t: new Date().toISOString() }].slice(-40)
  const patch: Record<string, unknown> = { episodes: eps, updated_at: new Date().toISOString() }
  if ((row.best_score ?? -1) < score) { const prevBest = row.best_score ?? null; patch.best_score = score; patch.best_score_at = new Date().toISOString(); void logLearn(admin, userId, gameId, 'record', `최고 점수 갱신 — ${score.toLocaleString()}점`, prevBest != null ? `이전 최고 ${prevBest.toLocaleString()}점 → ${score.toLocaleString()}점${b.cleared ? ' (클리어)' : ''}` : `첫 기록 ${score.toLocaleString()}점`, row.version) }
  const cur = eps.filter(e => e.v === row!.version)
  let changed: { policy: Policy; note: string } | null = null
  // ── 1) 템플릿 기본기 커리큘럼 — 템플릿이 미리 보유한 정석 지식을 2판마다 한 단계씩 학습 ──
  const rowX = row as typeof row & { template_skill?: number }
  const totalEps = eps.length
  const cu = await (async () => {
    // 게임 → 스튜디오 프로젝트 → 매핑된 템플릿 slug (없으면 장르 폴백)
    const { data: gm } = await admin.from('games').select('genre,studio_project_id').eq('id', gameId).maybeSingle()
    const game = gm as { genre: string | null; studio_project_id: string | null } | null
    let slug: string | null = null
    if (game?.studio_project_id) { const { data: pm } = await admin.from('prompt_mappings').select('template_slug').eq('project_id', game.studio_project_id).not('template_slug', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(); slug = (pm as { template_slug: string | null } | null)?.template_slug ?? null }
    return curriculumForAsync(slug, game?.genre ?? b.genre ?? null, gameId)
  })().catch(() => null)
  const skillIdx = rowX.template_skill ?? 0
  // 시간차 학습 — 단계 사이 최소 1시간 (실제 사람이 배우듯 천천히)
  const SKILL_INTERVAL_MS = 3600_000
  const lastSkillAt = (row as unknown as { last_skill_at?: string | null }).last_skill_at
  const skillReady = !lastSkillAt || Date.now() - new Date(lastSkillAt).getTime() >= SKILL_INTERVAL_MS
  if (row.auto_learn && cu && skillIdx < cu.skills.length && totalEps >= (skillIdx + 1) * 2 && skillReady && process.env.ANTHROPIC_API_KEY) {
    const skill = cu.skills[skillIdx]
    const m0 = b.manifest ?? {}
    const sk = (m0.stateKeys ?? (m0.sample ? Object.keys(m0.sample) : [])).slice(0, 40)
    const inp = (m0.inputs ?? []).slice(0, 12)
    if (sk.length && inp.length) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const sys = `너는 게임 봇 코치 컴파일러다. 아래 "정석 기술"을 이 게임의 상태 키와 입력으로 실행 가능한 규칙으로 바꾼다.
게임: ${b.gameTitle ?? ''} / 목표: ${m0.goal ?? '-'} / 입력(action): ${inp.join(', ')}
state() 키: ${sk.join(', ')}  예시 값: ${m0.sample ? JSON.stringify(m0.sample).slice(0, 400) : '-'}
기존 규칙(유지하며 아래 기술을 추가·정교화): ${JSON.stringify(row.rules).slice(0, 1200)}
출력 JSON 한 개만: {"rules":[{"cond":"s.x > 1","action":"right","hold":80,"why":"[기본기] ..."}],"summary":"한 문장"} — cond 는 s 만 쓰는 불리언 식, 최대 12개.`
        const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1200, system: sys, messages: [{ role: 'user', content: `정석 기술 ${skillIdx + 1}단계 "${skill.name}": ${skill.hint}` }] })
        const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
        const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as Partial<Policy>
        const rules = (Array.isArray(j.rules) ? j.rules : []).filter(r => r && typeof r.cond === 'string' && typeof r.action === 'string' && isSafeCond(r.cond) && inp.includes(r.action)).slice(0, 12).map(r => ({ cond: r.cond.slice(0, 200), action: r.action, hold: Math.max(30, Math.min(1500, Number(r.hold ?? 100))), why: String(r.why ?? `[기본기] ${skill.name}`).slice(0, 80) }))
        if (rules.length) {
          const botSkill = Math.round((0.3 + 0.7 * ((skillIdx + 1) / cu.skills.length)) * 100) / 100  // 기본기 진행도 → 내장 완성형 봇의 실력 해제
          const pol: Policy = { version: row.version + 1, tips: row.tips, rules, params: { ...row.params, botSkill }, summary: `기본기 ${skillIdx + 1}단계 "${skill.name}" 배웠어!` }
          Object.assign(patch, { version: pol.version, rules: pol.rules, params: pol.params, summary: pol.summary, template_skill: skillIdx + 1, last_skill_at: new Date().toISOString() })
          changed = { policy: pol, note: 'curriculum' }
          void logLearn(admin, userId, gameId, 'curriculum', `기본기 ${skillIdx + 1}단계 · ${skill.name}`, skill.hint, pol.version)
        }
      } catch { /* ignore */ }
    }
  }
  // ── 2) 커리큘럼을 다 배웠으면(또는 없으면) 자기 반성 개선 — 여기서부터는 이 유저만의 학습 ──
  if (!changed && row.auto_learn && cur.length >= 3 && cur.length % 3 === 0) {
    const avg = cur.reduce((a, e) => a + e.score, 0) / cur.length
    const bestAvg = row.best_avg ?? -Infinity
    if (avg >= bestAvg) { patch.best_avg = avg; patch.best_rules = row.rules }
    const m = b.manifest ?? {}
    const stateKeys = (m.stateKeys ?? (m.sample ? Object.keys(m.sample) : [])).slice(0, 40)
    const inputs = (m.inputs ?? []).slice(0, 12)
    if (avg < bestAvg * 0.85 && row.best_rules && row.best_rules.length) {
      // 회귀 — 최고 규칙으로 복귀
      const pol: Policy = { version: row.version + 1, tips: row.tips, rules: row.best_rules, params: row.params, summary: `새 시도가 별로라 잘되던 방식(평균 ${Math.round(bestAvg)}점)으로 돌아갔어` }
      Object.assign(patch, { version: pol.version, rules: pol.rules, summary: pol.summary, auto_count: (row.auto_count ?? 0) + 1 })
      changed = { policy: pol, note: 'revert' }
      void logLearn(admin, userId, gameId, 'revert', '잘되던 방식으로 복귀', `최근 평균이 최고 평균보다 낮아 이전 규칙으로 되돌림`, pol.version)
    } else if (!stateKeys.length || !inputs.length || !process.env.ANTHROPIC_API_KEY) {
      // 파라미터 진화(CEM 축소판) — 규칙을 만들 수 없는 게임도 봇 파라미터를 조금씩 변이시키며 좋아진 것만 채택(회귀 방지가 필터)
      const base = { reactionMs: 120, randomness: 0.15, botSkill: 0.3, ...row.params }
      const mut = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v * (0.85 + Math.random() * 0.3))) * 100) / 100
      const params = { ...base, reactionMs: mut(base.reactionMs, 30, 400), randomness: mut(base.randomness, 0, 0.5), botSkill: Math.round(Math.min(1, base.botSkill + 0.05) * 100) / 100 }
      const pol: Policy = { version: row.version + 1, tips: row.tips, rules: row.rules, params, summary: '반응 속도를 조금 조절해봤어' }
      Object.assign(patch, { version: pol.version, params: pol.params, summary: pol.summary, auto_count: (row.auto_count ?? 0) + 1 })
      changed = { policy: pol, note: 'evolve' }
      void logLearn(admin, userId, gameId, 'reflect', '파라미터 진화(변이 시도)', `reactionMs ${params.reactionMs} · randomness ${params.randomness} · botSkill ${params.botSkill}`, pol.version)
    } else if (process.env.ANTHROPIC_API_KEY && stateKeys.length && inputs.length) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const sys = `너는 게임 봇의 자기 반성 코치다. 현재 정책으로 최근 ${cur.length}판 평균 ${Math.round(avg)}점(최고 기록 평균 ${Number.isFinite(bestAvg) ? Math.round(bestAvg) : '-'}). 더 높은 점수/클리어를 위해 규칙을 개선한다.
게임: ${b.gameTitle ?? ''} (${b.genre ?? ''}) / 목표: ${m.goal ?? '-'} / 클리어: ${m.clearCondition ?? '-'}
조작: ${(m.controls ?? []).map(c => `${c.input}=${c.action}`).join(', ') || '-'} / 입력(action): ${inputs.join(', ')}
state() 키: ${stateKeys.join(', ')}  예시: ${m.sample ? JSON.stringify(m.sample).slice(0, 400) : '-'}
현재 규칙: ${JSON.stringify(row.rules).slice(0, 1500)} / params: ${JSON.stringify(row.params)}
사용자 조언(지켜야 함): ${(row.tips ?? []).slice(-8).join(' | ') || '없음'}
${demoSummary((row as unknown as { demos?: Demo[] }).demos)}
최근 판: ${cur.map(e => `${e.score}점/${e.sec}s${e.cleared ? '/클리어' : ''}`).join(', ')}
출력 JSON 한 개만: {"rules":[{"cond":"s.x > s.y","action":"right","hold":80,"why":"..."}],"params":{"reactionMs":60,"randomness":0.02},"summary":"AJ 가 사용자에게 하는 한 문장(반말, 무엇을 바꿨는지, 25자 이내)"}
규칙: cond 는 s(state) 만 쓰는 JS 불리언 식. 작게 한두 가지만 바꾼다(탐색은 점진적으로). 최대 12개.`
        const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1200, system: sys, messages: [{ role: 'user', content: '개선안을 내줘.' }] })
        const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
        const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as Partial<Policy>
        const rules = (Array.isArray(j.rules) ? j.rules : []).filter(r => r && typeof r.cond === 'string' && typeof r.action === 'string' && isSafeCond(r.cond) && inputs.includes(r.action)).slice(0, 12).map(r => ({ cond: r.cond.slice(0, 200), action: r.action, hold: Math.max(30, Math.min(1500, Number(r.hold ?? 100))), why: String(r.why ?? '').slice(0, 80) }))
        if (rules.length) {
          const params: Record<string, number> = { ...row.params }; for (const [k, v] of Object.entries(j.params ?? {})) if (/^\w{1,24}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) params[k] = v
          const pol: Policy = { version: row.version + 1, tips: row.tips, rules, params, summary: typeof j.summary === 'string' ? j.summary.slice(0, 120) : '스스로 조금 더 배웠어' }
          Object.assign(patch, { version: pol.version, rules: pol.rules, params: pol.params, summary: pol.summary, auto_count: (row.auto_count ?? 0) + 1 })
          changed = { policy: pol, note: 'improve' }
          void logLearn(admin, userId, gameId, 'reflect', '자기 반성 개선', pol.summary ?? '', pol.version)
        }
      } catch { /* ignore */ }
    }
  }
  await admin.from('aj_play_policies').update(patch as never).eq('id', row.id)
  // AI 가 한 판을 끝냈다 — 플레이 기록 (정책 변화가 없어도 남긴다)
  if (!changed) void logLearn(admin, userId, gameId, 'play', `AI 플레이 ${eps.length}판째 · ${b.cleared ? '클리어' : '점수 ' + score}`, `이번 판 점수 ${score}${b.cleared ? ' (최종 클리어!)' : ''}`, row.version)
  return Response.json({ ok: true, policy: changed?.policy ?? null, note: changed?.note ?? null, episodes: cur.length })
}

// ── 인간 플레이 데모(모방 학습) ──────────────────────────────────────────────
// 사람이 직접 플레이할 때 게임이 0.2초마다 (상태 수치, 눌린 입력)을 보낸다 → 정책 행에 최근 600샘플 보관.
// 코칭/자동 학습 프롬프트에 "입력별로 어떤 상태일 때 눌렀는지" 통계 요약을 넣어 Haiku 가 사람 스타일의 규칙을 만들게 한다.
type Demo = { s: Record<string, number>; k: string[]; p?: [number, number] }
async function saveDemo(admin: ReturnType<typeof createAdminClient>, userId: string, gameId: string, samples: Demo[]) {
  const clean = samples.filter(x => x && typeof x === 'object' && x.s && Array.isArray(x.k)).slice(0, 100).map(x => ({ s: Object.fromEntries(Object.entries(x.s).filter(([k, v]) => /^\w{1,24}$/.test(k) && typeof v === 'number' && Number.isFinite(v)).slice(0, 16)), k: x.k.filter(k => typeof k === 'string').slice(0, 6), ...(Array.isArray((x as Demo).p) && (x as Demo).p!.length === 2 && (x as Demo).p!.every(n => typeof n === 'number') ? { p: (x as Demo).p } : {}) }))
  if (!clean.length) return Response.json({ ok: true, kept: 0 })
  const { data } = await admin.from('aj_play_policies').select('id,demos,best_score').eq('game_id', gameId).eq('user_id', userId).maybeSingle()
  const row = data as { id: string; demos: Demo[] | null; best_score: number | null } | null
  const before = (row?.demos as Demo[] | null)?.length ?? 0
  const demos = [...((row?.demos as Demo[] | null) ?? []), ...clean].slice(-600)
  // 사람이 플레이한 이번 배치의 최고 점수 — 이전 최고보다 높으면 갱신·기록 (내 플레이도 실력 추적에 포함)
  const maxScore = clean.reduce((m, x) => { const sc = x.s.score; return typeof sc === 'number' && sc > m ? sc : m }, -Infinity)
  const upd: Record<string, unknown> = { demos, updated_at: new Date().toISOString() }
  if (row && Number.isFinite(maxScore) && (row.best_score ?? -1) < maxScore) { const prevBest = row.best_score ?? null; upd.best_score = maxScore; upd.best_score_at = new Date().toISOString(); void logLearn(admin, userId, gameId, 'record', `최고 점수 갱신 — ${maxScore.toLocaleString()}점 (내 플레이)`, prevBest != null ? `이전 최고 ${prevBest.toLocaleString()}점 → ${maxScore.toLocaleString()}점` : `첫 기록 ${maxScore.toLocaleString()}점`, null) }
  if (row) await admin.from('aj_play_policies').update(upd as never).eq('id', row.id)
  else await admin.from('aj_play_policies').insert([{ game_id: gameId, user_id: userId, version: 1, tips: [], rules: [], params: {}, demos, ...(Number.isFinite(maxScore) ? { best_score: maxScore, best_score_at: new Date().toISOString() } : {}) }] as never)
  // 사람 플레이 관찰 — 75샘플(약 15초) 단위로 학습 기록에 남긴다 (매 배치마다 남기면 과도)
  if (Math.floor(demos.length / 75) > Math.floor(before / 75)) void logLearn(admin, userId, gameId, 'demo', `내 플레이 관찰 — 누적 ${demos.length}샘플`, '사람이 어떤 상황에서 어떤 조작을 하는지 배우는 중', null)
  return Response.json({ ok: true, kept: demos.length })
}
function demoSummary(demos: Demo[] | null | undefined): string {
  if (!demos || demos.length < 20) return ''
  const feats = new Set<string>(); for (const d of demos) for (const k of Object.keys(d.s)) feats.add(k)
  const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const lines: string[] = []
  const actions = new Set<string>(); for (const d of demos) for (const k of d.k) actions.add(k)
  for (const a of actions) {
    const on = demos.filter(d => d.k.includes(a)), off = demos.filter(d => !d.k.includes(a))
    if (on.length < 5) continue
    const num = (arr: Demo[], f: string) => mean(arr.map(x => x.s[f]).filter((v): v is number => typeof v === 'number'))
    const diffs = [...feats].map(f => { const mo = num(on, f); const mf = num(off, f); return { f, mo, mf, d: Math.abs(mo - mf) } }).sort((x, y) => y.d - x.d).slice(0, 3)
    lines.push(`- ${a} 누름(${on.length}/${demos.length} 샘플): ` + diffs.map(x => `${x.f} 평균 ${x.mo.toFixed(1)} (안 누를 때 ${x.mf.toFixed(1)})`).join(', '))
  }
  const taps = demos.filter(d => Array.isArray(d.p))
  if (taps.length >= 5) {
    const feats2 = [...feats]
    const byRegion: Record<string, number> = {}
    for (const d of taps) { const [x, y] = d.p!; byRegion[`${x < 0.33 ? '좌' : x > 0.66 ? '우' : '중'}${y < 0.4 ? '상' : y > 0.7 ? '하' : '중'}`] = (byRegion[`${x < 0.33 ? '좌' : x > 0.66 ? '우' : '중'}${y < 0.4 ? '상' : y > 0.7 ? '하' : '중'}`] ?? 0) + 1 }
    const top = Object.entries(byRegion).sort((a, b2) => b2[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}회`).join(', ')
    const near = feats2.map(f => { const mt = mean(taps.map(d => d.s[f]).filter((v): v is number => typeof v === 'number')); const ma = mean(demos.map(d => d.s[f]).filter((v): v is number => typeof v === 'number')); return { f, d: Math.abs(mt - ma), mt } }).sort((a, b2) => b2.d - a.d).slice(0, 2)
    lines.push(`- 화면 탭 위치(${taps.length}회): ${top}${near.length ? ` — 탭 시점의 상태: ${near.map(x => `${x.f}≈${x.mt.toFixed(1)}`).join(', ')}` : ''}`)
  }
  if (!lines.length) return ''
  return `[인간 플레이 데모 요약 — 사람이 어떤 상태에서 어떤 입력을 눌렀는지] 이 통계를 참고해 사람 스타일을 따라하는 규칙을 우선 만든다:\n${lines.join('\n')}`
}

async function logLearn(admin: ReturnType<typeof createAdminClient>, userId: string, gameId: string, kind: string, title: string, detail: string, version: number | null) {
  try { await admin.from('aj_learn_log').insert([{ game_id: gameId, user_id: userId, kind, title: title.slice(0, 120), detail: detail.slice(0, 500) || null, version }] as never) } catch { /* ignore */ }
}
