// MLPilot v2 관리자 API — 예시/규칙/소스/피드백 조회·CRUD, 업로드(CSV/MD/트랜스크립트), 설정, 학습 실행
import { requireAdmin } from '@/lib/admin/guard'
import { loadTalkSettings, saveTalkSettings, invalidateTalkKb, SITUATIONS, EMOTIONS, RULE_KINDS, SITUATION_LABEL, EMOTION_LABEL } from '@/lib/mlpilot/talk'
import { parseCsv, csvToExamples, labelTranscript, mdToRulesAndExamples, saveExamples } from '@/lib/mlpilot/ingest'
import { isAuto, logAutomation } from '@/lib/automation'
import { randomBytes } from 'node:crypto'

export const maxDuration = 300

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const u = new URL(req.url)
  const tab = u.searchParams.get('tab') ?? 'overview'
  const settings = await loadTalkSettings()
  const A = g.admin
  if (tab === 'examples') {
    let q = A.from('aj_talk_examples').select('*').order('created_at', { ascending: false }).limit(1000)
    const f = u.searchParams
    if (f.get('approved') === '1') q = q.eq('approved', true); if (f.get('approved') === '0') q = q.eq('approved', false)
    if (f.get('genre')) q = q.eq('genre', f.get('genre')!); if (f.get('situation')) q = q.eq('situation', f.get('situation')!)
    const { data, error } = await q
    if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
    return Response.json({ rows: data ?? [] })
  }
  if (tab === 'rules') { const { data, error } = await A.from('aj_talk_rules').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }); if (error) return Response.json({ error: error.message }, { status: 500 }); return Response.json({ rows: data ?? [] }) }
  if (tab === 'sources') { const { data, error } = await A.from('aj_talk_sources').select('*').order('created_at', { ascending: false }).limit(200); if (error) return Response.json({ error: error.message }, { status: 500 }); return Response.json({ rows: data ?? [] }) }
  if (tab === 'feedback') { const { data, error } = await A.from('aj_talk_feedback').select('*').order('created_at', { ascending: false }).limit(300); if (error) return Response.json({ error: error.message }, { status: 500 }); return Response.json({ rows: data ?? [] }) }
  // overview
  const [{ count: exTotal, error }, { count: exApproved }, { count: exPending }, { count: rules }, { count: fb }, { count: fb7 }, { data: bySit }, { data: srcs }] = await Promise.all([
    A.from('aj_talk_examples').select('id', { count: 'exact', head: true }),
    A.from('aj_talk_examples').select('id', { count: 'exact', head: true }).eq('approved', true),
    A.from('aj_talk_examples').select('id', { count: 'exact', head: true }).eq('approved', false),
    A.from('aj_talk_rules').select('id', { count: 'exact', head: true }).eq('enabled', true),
    A.from('aj_talk_feedback').select('id', { count: 'exact', head: true }),
    A.from('aj_talk_feedback').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    A.from('aj_talk_examples').select('situation,emotion,genre,approved').limit(5000),
    A.from('aj_talk_sources').select('*').order('created_at', { ascending: false }).limit(8),
  ])
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const sit: Record<string, number> = {}, emo: Record<string, number> = {}, gen: Record<string, number> = {}
  for (const r of (bySit ?? []) as { situation: string; emotion: string | null; genre: string | null; approved: boolean }[]) { if (!r.approved) continue; sit[r.situation] = (sit[r.situation] ?? 0) + 1; if (r.emotion) emo[r.emotion] = (emo[r.emotion] ?? 0) + 1; gen[r.genre ?? '공통'] = (gen[r.genre ?? '공통'] ?? 0) + 1 }
  return Response.json({ settings: { ...settings, ingestKey: settings.ingestKey ? settings.ingestKey.slice(0, 6) + '…' + settings.ingestKey.slice(-4) : null, hasKey: !!settings.ingestKey }, counts: { examples: exTotal ?? 0, approved: exApproved ?? 0, pending: exPending ?? 0, rules: rules ?? 0, feedback: fb ?? 0, feedback7: fb7 ?? 0 }, bySituation: sit, byEmotion: emo, byGenre: gen, sources: srcs ?? [], meta: { situations: SITUATIONS, emotions: EMOTIONS, ruleKinds: RULE_KINDS, situationLabel: SITUATION_LABEL, emotionLabel: EMOTION_LABEL } })
}

export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const raw = await req.text().catch(() => '')
  if (raw.length > 4_000_000) return Response.json({ error: '업로드는 4MB 이하로 나눠 올려주세요.' }, { status: 413 })
  const b = (() => { try { return JSON.parse(raw) as Record<string, unknown> } catch { return null } })()
  if (!b?.action) return Response.json({ error: 'bad request' }, { status: 400 })
  const A = g.admin
  const autoApprove = await isAuto('mlpilot.autoLearn')
  try {
    switch (b.action) {
      case 'addExample': {
        const e = b.example as { utterance: string; situation: string; emotion?: string; trigger_text?: string; genre?: string; lang?: string; tags?: string[] }
        if (!e?.utterance?.trim()) return Response.json({ error: '대사는 필수' }, { status: 400 })
        const { error } = await A.from('aj_talk_examples').insert([{ source: 'admin', genre: e.genre || null, situation: e.situation || 'commentary', emotion: e.emotion || null, trigger_text: e.trigger_text || null, utterance: e.utterance.trim(), lang: e.lang || (/[가-힣]/.test(e.utterance) ? 'ko' : 'en'), tags: e.tags ?? [], quality: 0.7, approved: true, created_by: g.user.id }] as never)
        if (error) throw error; invalidateTalkKb(); return Response.json({ ok: true })
      }
      case 'uploadCsv': {
        const rows = parseCsv(String(b.text ?? ''))
        const list = csvToExamples(rows, { genre: (b.genre as string) || null })
        if (!list.length) return Response.json({ error: '읽을 수 있는 행이 없어요. 헤더에 utterance(또는 text) 열이 필요해요.' }, { status: 400 })
        const r = await saveExamples(list, { source: 'csv', sourceName: String(b.name ?? 'upload.csv'), kind: 'csv', genre: (b.genre as string) || null, createdBy: g.user.id, approved: autoApprove })
        await logAutomation({ module: 'mlpilot', action: `CSV ${r.imported}건 수집${autoApprove ? '(자동 승인)' : '(승인 대기)'}`, target: String(b.name ?? ''), status: autoApprove ? 'ok' : 'needs_review' })
        return Response.json({ ok: true, ...r })
      }
      case 'uploadTranscript': {
        // text: "화자: 대사" 줄 단위 또는 CSV(speaker,text,event)
        const text = String(b.text ?? '')
        let lines: { speaker?: string; text: string; event?: string | null }[]
        if (/^(speaker|화자)\s*,/i.test(text.trim())) lines = parseCsv(text).map(r => ({ speaker: r.speaker || r['화자'], text: r.text || r['대사'] || '', event: r.event || null }))
        else lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^\[?([^\]:]{1,20})\]?\s*[:：]\s*(.+)$/); return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: 'BJ', text: l } })
        lines = lines.filter(l => l.text.length >= 2).slice(0, 2000)
        const list = await labelTranscript(lines, { genre: (b.genre as string) || null, bjName: (b.bjName as string) || undefined })
        if (!list.length) return Response.json({ error: 'AI 라벨링 결과가 없어요 (ANTHROPIC_API_KEY 또는 내용 확인).' }, { status: 400 })
        const r = await saveExamples(list, { source: 'human_bj', sourceName: String(b.name ?? 'transcript'), kind: 'transcript', genre: (b.genre as string) || null, createdBy: g.user.id, approved: autoApprove })
        await logAutomation({ module: 'mlpilot', action: `인간 BJ 트랜스크립트 ${lines.length}줄 → 예시 ${r.imported}건 라벨링${autoApprove ? '(자동 승인)' : '(승인 대기)'}`, target: String(b.name ?? ''), status: autoApprove ? 'ok' : 'needs_review' })
        return Response.json({ ok: true, ...r, lines: lines.length })
      }
      case 'uploadMd': {
        const { rule, examples } = await mdToRulesAndExamples(String(b.text ?? ''), { genre: (b.genre as string) || null, title: (b.name as string) || undefined })
        const { error } = await A.from('aj_talk_rules').insert([{ ...rule, priority: 5, enabled: true, created_by: g.user.id }] as never)
        if (error) throw error
        const r = examples.length ? await saveExamples(examples, { source: 'md', sourceName: String(b.name ?? 'guide.md'), kind: 'md', genre: (b.genre as string) || null, createdBy: g.user.id, approved: autoApprove }) : { imported: 0, total: 0 }
        invalidateTalkKb()
        await logAutomation({ module: 'mlpilot', action: `MD 가이드 → 규칙 1건 + 예시 ${r.imported}건`, target: String(b.name ?? ''), status: 'ok' })
        return Response.json({ ok: true, ...r })
      }
      case 'addRule': {
        const r = b.rule as { scope: string; genre?: string; game_id?: string; kind: string; title?: string; content: string; priority?: number }
        if (!r?.content?.trim()) return Response.json({ error: '내용 필수' }, { status: 400 })
        const { error } = await A.from('aj_talk_rules').insert([{ scope: r.scope || 'global', genre: r.genre || null, game_id: r.game_id || null, kind: r.kind || 'style', title: r.title || null, content: r.content.trim(), priority: r.priority ?? 0, enabled: true, created_by: g.user.id }] as never)
        if (error) throw error; invalidateTalkKb(); return Response.json({ ok: true })
      }
      case 'rotateKey': { const key = 'mlp_' + randomBytes(24).toString('base64url'); await saveTalkSettings({ ingestKey: key }); return Response.json({ ok: true, key }) }
      case 'learn': {
        // 학습: 피드백 신호로 예시 품질 갱신 + 고성과 발화를 예시 후보로 승격
        const { data: fb } = await A.from('aj_talk_feedback').select('id,genre,situation,emotion,viewer_text,utterance,example_ids,signal_reply,signal_like,rating').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).limit(5000)
        const rows = (fb ?? []) as { genre: string; situation: string; emotion: string | null; viewer_text: string | null; utterance: string; example_ids: string[]; signal_reply: boolean; signal_like: boolean; rating: number | null }[]
        const score: Record<string, { n: number; s: number }> = {}
        let promoted = 0
        const candidates: { utterance: string; genre: string; situation: string; emotion: string | null; trigger: string | null }[] = []
        for (const r of rows) {
          const v = (r.rating != null ? (r.rating > 0 ? 1 : -1) : 0) + (r.signal_reply ? 0.5 : 0) + (r.signal_like ? 0.5 : 0)
          for (const id of r.example_ids ?? []) { const x = (score[id] ??= { n: 0, s: 0 }); x.n++; x.s += v }
          if (v >= 1.5 || (r.rating ?? 0) > 0) candidates.push({ utterance: r.utterance, genre: r.genre, situation: r.situation, emotion: r.emotion, trigger: r.viewer_text })
        }
        const { data: exs } = await A.from('aj_talk_examples').select('id,quality').in('id', Object.keys(score).slice(0, 500))
        for (const e of (exs ?? []) as { id: string; quality: number }[]) { const x = score[e.id]; if (!x || x.n < 3) continue; const avg = x.s / x.n; const q = Math.max(0.05, Math.min(1, e.quality + avg * 0.05)); if (Math.abs(q - e.quality) > 0.001) await A.from('aj_talk_examples').update({ quality: q } as never).eq('id', e.id) }
        const seen = new Set<string>()
        for (const c of candidates.slice(0, 50)) { const k = c.utterance.trim().toLowerCase(); if (seen.has(k)) continue; seen.add(k); const { data: dup } = await A.from('aj_talk_examples').select('id').eq('utterance', c.utterance).limit(1); if (dup && dup.length) continue; await A.from('aj_talk_examples').insert([{ source: 'auto', genre: c.genre, situation: c.situation, emotion: c.emotion, trigger_text: c.trigger, utterance: c.utterance, lang: /[가-힣]/.test(c.utterance) ? 'ko' : 'en', quality: 0.65, approved: autoApprove }] as never); promoted++ }
        invalidateTalkKb()
        await logAutomation({ module: 'mlpilot', action: `학습 실행 — 피드백 ${rows.length}건 반영, 예시 ${Object.keys(score).length}개 품질 갱신, ${promoted}개 승격${autoApprove ? '(자동 승인)' : '(승인 대기)'}`, status: promoted && !autoApprove ? 'needs_review' : 'ok' })
        return Response.json({ ok: true, feedback: rows.length, updated: Object.keys(score).length, promoted })
      }
      default: return Response.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return Response.json({ error: 'bad request' }, { status: 400 })
  const A = g.admin
  if (b.settings) { await saveTalkSettings(b.settings as never); return Response.json({ ok: true }) }
  if (b.example && typeof b.id === 'string') { const { error } = await A.from('aj_talk_examples').update(b.example as never).eq('id', b.id); if (error) return Response.json({ error: error.message }, { status: 500 }); invalidateTalkKb(); return Response.json({ ok: true }) }
  if (b.rule && typeof b.id === 'string') { const { error } = await A.from('aj_talk_rules').update({ ...(b.rule as object), updated_at: new Date().toISOString() } as never).eq('id', b.id); if (error) return Response.json({ error: error.message }, { status: 500 }); invalidateTalkKb(); return Response.json({ ok: true }) }
  if (typeof b.feedbackId === 'string' && typeof b.rating === 'number') { const { error } = await A.from('aj_talk_feedback').update({ rating: b.rating } as never).eq('id', b.feedbackId); if (error) return Response.json({ error: error.message }, { status: 500 }); return Response.json({ ok: true }) }
  if (Array.isArray(b.approveIds)) { const { error } = await A.from('aj_talk_examples').update({ approved: !!b.approved } as never).in('id', b.approveIds as string[]); if (error) return Response.json({ error: error.message }, { status: 500 }); invalidateTalkKb(); return Response.json({ ok: true }) }
  return Response.json({ error: 'bad request' }, { status: 400 })
}

export async function DELETE(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { table?: 'example' | 'rule' | 'source'; id?: string } | null
  if (!b?.id || !b.table) return Response.json({ error: 'bad request' }, { status: 400 })
  const t = b.table === 'example' ? 'aj_talk_examples' : b.table === 'rule' ? 'aj_talk_rules' : 'aj_talk_sources'
  if (b.table === 'source') await g.admin.from('aj_talk_examples').delete().eq('source_id', b.id)
  const { error } = await g.admin.from(t).delete().eq('id', b.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  invalidateTalkKb(); return Response.json({ ok: true })
}
