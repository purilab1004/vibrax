// AJ 플레이 코칭 — 내 AI 가 대신 플레이하는 동안 말로 가르치면, Haiku 가 게임 매니페스트(state 키·입력)를 보고
// 실행 가능한 정책 규칙 {cond, action, hold} 로 컴파일해 저장(버전업)하고 게임 봇에 전달한다. 세션이 바뀌어도 유지.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, tooMany, isSafeCond } from '@/lib/security/ratelimit'

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
  const b = await req.json().catch(() => null) as { gameId?: string; message?: string; manifest?: Manifest | null; genre?: string; gameTitle?: string; action?: 'coach' | 'episode'; score?: number; cleared?: boolean; durationSec?: number } | null
  if (!b?.gameId) return Response.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  if (b.action === 'episode') { if (!rateLimit(`ep:${user.id}`, 120, 3600_000).ok) return tooMany(); return await autoLearn(admin, user.id, b) }
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
  return Response.json({ ok: true, policy: out })
}

export async function PATCH(req: Request) {
  // 최고 점수 갱신 (학습 효과 추적)
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null) as { gameId?: string; score?: number } | null
  if (!b?.gameId || typeof b.score !== 'number') return Response.json({ error: 'bad request' }, { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('aj_play_policies').select('id,best_score').eq('game_id', b.gameId).eq('user_id', user.id).maybeSingle()
  const cur = data as { id: string; best_score: number | null } | null
  if (cur && (cur.best_score ?? -1) < b.score) await admin.from('aj_play_policies').update({ best_score: b.score } as never).eq('id', cur.id)
  return Response.json({ ok: true })
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
  if ((row.best_score ?? -1) < score) patch.best_score = score
  const cur = eps.filter(e => e.v === row!.version)
  let changed: { policy: Policy; note: string } | null = null
  if (row.auto_learn && cur.length >= 3 && cur.length % 3 === 0) {
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
    } else if (process.env.ANTHROPIC_API_KEY && stateKeys.length && inputs.length) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const sys = `너는 게임 봇의 자기 반성 코치다. 현재 정책으로 최근 ${cur.length}판 평균 ${Math.round(avg)}점(최고 기록 평균 ${Number.isFinite(bestAvg) ? Math.round(bestAvg) : '-'}). 더 높은 점수/클리어를 위해 규칙을 개선한다.
게임: ${b.gameTitle ?? ''} (${b.genre ?? ''}) / 목표: ${m.goal ?? '-'} / 클리어: ${m.clearCondition ?? '-'}
조작: ${(m.controls ?? []).map(c => `${c.input}=${c.action}`).join(', ') || '-'} / 입력(action): ${inputs.join(', ')}
state() 키: ${stateKeys.join(', ')}  예시: ${m.sample ? JSON.stringify(m.sample).slice(0, 400) : '-'}
현재 규칙: ${JSON.stringify(row.rules).slice(0, 1500)} / params: ${JSON.stringify(row.params)}
사용자 조언(지켜야 함): ${(row.tips ?? []).slice(-8).join(' | ') || '없음'}
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
        }
      } catch { /* ignore */ }
    }
  }
  await admin.from('aj_play_policies').update(patch as never).eq('id', row.id)
  return Response.json({ ok: true, policy: changed?.policy ?? null, note: changed?.note ?? null, episodes: cur.length })
}
