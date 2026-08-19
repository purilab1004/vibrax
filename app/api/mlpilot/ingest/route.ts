// MLPilot v2 외부 수집 웹훅 — n8n/Make/Zapier 등에서 호출. 헤더 x-mlpilot-key 필요.
// body: { examples: [{utterance, situation?, emotion?, trigger_text?, genre?, lang?, tags?}] } | { transcript: [{speaker?, text, event?}], genre?, bjName?, name? } | { rule: {scope?, genre?, kind?, title?, content} }
import { loadTalkSettings, invalidateTalkKb } from '@/lib/mlpilot/talk'
import { labelTranscript, saveExamples, type ExampleInput } from '@/lib/mlpilot/ingest'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuto, logAutomation } from '@/lib/automation'
import { timingSafeEqual } from 'node:crypto'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'
import { requestIp } from '@/lib/security/log'

export const maxDuration = 300
export async function POST(req: Request) {
  const s = await loadTalkSettings()
  const key = req.headers.get('x-mlpilot-key') ?? ''
  if (!rateLimit(`ingest:${requestIp(req.headers) ?? 'x'}`, 60, 600_000).ok) return tooMany()
  const ok = !!s.ingestKey && key.length === s.ingestKey.length && timingSafeEqual(Buffer.from(key), Buffer.from(s.ingestKey))
  if (!ok) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const raw = await req.text().catch(() => '')
  if (raw.length > 2_000_000) return Response.json({ error: 'payload too large (2MB)' }, { status: 413 })
  const b = (() => { try { return JSON.parse(raw) } catch { return null } })() as { examples?: ExampleInput[]; transcript?: { speaker?: string; text: string; event?: string | null }[]; rule?: { scope?: string; genre?: string; kind?: string; title?: string; content: string }; genre?: string; bjName?: string; name?: string } | null
  if (!b) return Response.json({ error: 'bad json' }, { status: 400 })
  const autoApprove = await isAuto('mlpilot.autoLearn')
  if (Array.isArray(b.examples) && b.examples.length) {
    const list = b.examples.filter(e => e?.utterance?.trim()).slice(0, 2000)
    const r = await saveExamples(list, { source: 'webhook', sourceName: b.name ?? 'webhook', kind: 'webhook', genre: b.genre ?? null, approved: autoApprove })
    await logAutomation({ module: 'mlpilot', action: `웹훅 예시 ${r.imported}건 수집`, target: b.name ?? 'webhook', status: autoApprove ? 'ok' : 'needs_review' })
    return Response.json({ ok: true, ...r })
  }
  if (Array.isArray(b.transcript) && b.transcript.length) {
    const list = await labelTranscript(b.transcript.slice(0, 2000), { genre: b.genre ?? null, bjName: b.bjName })
    const r = await saveExamples(list, { source: 'human_bj', sourceName: b.name ?? 'webhook-transcript', kind: 'transcript', genre: b.genre ?? null, approved: autoApprove })
    await logAutomation({ module: 'mlpilot', action: `웹훅 트랜스크립트 ${b.transcript.length}줄 → 예시 ${r.imported}건`, target: b.name ?? 'webhook', status: autoApprove ? 'ok' : 'needs_review' })
    return Response.json({ ok: true, ...r })
  }
  if (b.rule?.content?.trim()) {
    const { error } = await createAdminClient().from('aj_talk_rules').insert([{ scope: b.rule.scope ?? 'global', genre: b.rule.genre ?? null, kind: b.rule.kind ?? 'style', title: b.rule.title ?? null, content: b.rule.content.trim(), priority: 0, enabled: true }] as never)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    invalidateTalkKb(); return Response.json({ ok: true })
  }
  return Response.json({ error: 'nothing to ingest' }, { status: 400 })
}
