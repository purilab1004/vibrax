// 게임 등록 직후 스팸 심사 — 규칙 + AI(Haiku) 판정. 자동화 on 이면 스팸은 즉시 삭제(내용은 처리 내역에 보관), off 면 검토 대기로만.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuto, logAutomation } from '@/lib/automation'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'

const SPAM_WORDS = /카지노|바카라|토토|슬롯머신|먹튀|성인\s*사이트|야동|비아그라|시알리스|대출\s*(상담|문의)|텔레그램\s*@|텔레\s*@|casino|viagra|cialis|porn|xxx|escort|airdrop|free\s*crypto|bet365|1xbet|onlyfans|telegram\s*@/i
const ALLOWED_HOSTS = ['vibrexcup.com', 'www.vibrexcup.com', 'localhost']
function ruleCheck(g: { title: string; description?: string | null; game_manual?: string | null; play_url: string; teaser?: string | null }) {
  const reasons: string[] = []
  const text = [g.title, g.description, g.game_manual, g.teaser].filter(Boolean).join(' ')
  if (SPAM_WORDS.test(text)) reasons.push('스팸 키워드')
  const urls = text.match(/https?:\/\/[^\s)]+/gi) ?? []
  if (urls.length >= 2) reasons.push(`본문 외부 링크 ${urls.length}개`)
  if (/(.)\1{9,}/.test(text)) reasons.push('반복 문자')
  try { const h = new URL(g.play_url).hostname; if (/\.(ru|top|xyz|click|tk|ml|ga|cf|gq)$/i.test(h) && !ALLOWED_HOSTS.includes(h)) reasons.push(`의심 도메인 ${h}`) } catch { reasons.push('play_url 형식 오류') }
  return reasons
}
async function aiJudge(g: { title: string; description?: string | null; game_manual?: string | null; play_url: string; teaser?: string | null }, hints: string[]) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 120,
      system: '너는 게임 공유 플랫폼의 스팸 심사관이다. 등록된 게임 메타데이터를 보고 스팸/도박/성인/피싱/광고성(게임이 아닌 외부 유도)인지 판정한다. 오직 JSON 한 줄로만 답한다: {"spam":true|false,"confidence":0~1,"reason":"짧게"}. 평범한 게임(부족한 설명·영어·단순 제목)은 spam=false.',
      messages: [{ role: 'user', content: `제목: ${g.title}\n설명: ${g.description ?? ''}\n조작법: ${g.game_manual ?? ''}\n훅: ${g.teaser ?? ''}\nplay_url: ${g.play_url}\n규칙 힌트: ${hints.join(', ') || '없음'}` }] })
    const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as { spam?: boolean; confidence?: number; reason?: string }
    return { spam: !!j.spam, confidence: Number(j.confidence ?? 0), reason: String(j.reason ?? '') }
  } catch { return null }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { id?: string } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!rateLimit(`screen:${user.id}`, 20, 3600_000).ok) return tooMany()
  const admin = createAdminClient()
  const { data } = await admin.from('games').select('id,title,description,game_manual,play_url,teaser,user_id,genre,thumbnail_url,created_at').eq('id', b.id).maybeSingle()
  const g = data as { id: string; title: string; description?: string | null; game_manual?: string | null; play_url: string; teaser?: string | null; user_id: string; genre: string; thumbnail_url: string; created_at: string } | null
  if (!g || g.user_id !== user.id) return Response.json({ ok: true, removed: false })
  const hints = ruleCheck(g)
  const ai = await aiJudge(g, hints)
  const spam = ai ? (ai.spam && ai.confidence >= 0.7) || (hints.length >= 2 && ai.spam) : hints.length >= 2
  const reason = [...hints, ai?.reason].filter(Boolean).join(' · ')
  if (!spam) { if (hints.length > 0) void logAutomation({ module: 'games', action: '게임 심사 — 통과(경미한 의심)', target: g.title, status: 'ok', detail: { id: g.id, hints, ai } }); return Response.json({ ok: true, removed: false }) }
  if (!(await isAuto('games.autoSpam'))) { await logAutomation({ module: 'games', action: '의심 게임 — 검토 필요', target: g.title, status: 'needs_review', detail: { id: g.id, reason, ai, user_id: g.user_id } }); return Response.json({ ok: true, removed: false }) }
  const { error } = await admin.from('games').delete().eq('id', g.id)
  await logAutomation({ module: 'games', action: error ? '의심 게임 자동 삭제 실패' : '의심 게임 자동 삭제(스팸)', target: g.title, status: error ? 'error' : 'ok', detail: { reason, ai, game: g, error: error?.message } })
  return Response.json({ ok: true, removed: !error, reason })
}
