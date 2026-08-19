// MLPilot v2 — 데이터 수집: CSV/MD/트랜스크립트 파싱 + Haiku 라벨링 + 저장 (서버 전용)
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITUATIONS, EMOTIONS, invalidateTalkKb, loadTalkSettings } from './talk'

export interface ExampleInput { genre?: string | null; game_id?: string | null; situation?: string; emotion?: string | null; trigger_text?: string | null; utterance: string; lang?: string | null; tags?: string[]; quality?: number; approved?: boolean }

/** 아주 단순한 CSV 파서 (따옴표·줄바꿈 지원). 첫 줄 = 헤더 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = []; let field = ''; let q = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) { if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c }
    else if (c === '"') q = true
    else if (c === ',') { cur.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; cur.push(field); field = ''; if (cur.some(x => x.trim())) rows.push(cur); cur = [] }
    else field += c
  }
  if (field || cur.length) { cur.push(field); if (cur.some(x => x.trim())) rows.push(cur) }
  if (rows.length < 2) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
const norm = (v: string | undefined | null, allowed: readonly string[], fallback: string | null) => { const x = (v ?? '').trim().toLowerCase(); return allowed.includes(x) ? x : fallback }

/** CSV 행 → 예시 입력 (열 이름: situation, emotion, trigger|trigger_text, utterance|text|line, genre, lang, tags, quality) */
export function csvToExamples(rows: Record<string, string>[], defaults: { genre?: string | null }): ExampleInput[] {
  return rows.map(r => ({
    utterance: r.utterance || r.text || r.line || r['발화'] || r['대사'] || '',
    situation: norm(r.situation || r['상황'], SITUATIONS, 'commentary')!,
    emotion: norm(r.emotion || r['감정'], EMOTIONS, null),
    trigger_text: r.trigger || r.trigger_text || r['트리거'] || r['상황설명'] || null,
    genre: r.genre || defaults.genre || null,
    lang: r.lang || (/[가-힣]/.test(r.utterance || r.text || '') ? 'ko' : 'en'),
    tags: (r.tags || '').split(/[;|,]/).map(s => s.trim()).filter(Boolean),
    quality: r.quality ? Math.max(0, Math.min(1, Number(r.quality))) : 0.6,
  })).filter(e => e.utterance.trim().length >= 2)
}

/** 인간 BJ 트랜스크립트(시간순 대사) → Haiku 가 상황·감정·트리거를 라벨링해 예시로 변환 */
export async function labelTranscript(lines: { speaker?: string; text: string; event?: string | null }[], opts: { genre?: string | null; bjName?: string }): Promise<ExampleInput[]> {
  if (!process.env.ANTHROPIC_API_KEY || lines.length === 0) return []
  const s = await loadTalkSettings()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const out: ExampleInput[] = []
  // 40줄씩 묶어서 라벨링 (앞뒤 문맥 포함)
  for (let i = 0; i < lines.length; i += 40) {
    const chunk = lines.slice(i, i + 40)
    const numbered = chunk.map((l, j) => `${j}\t${l.speaker ?? 'BJ'}\t${l.event ? `[event:${l.event}] ` : ''}${l.text}`).join('\n')
    try {
      const msg = await client.messages.create({ model: s.labelModel, max_tokens: 3000,
        system: `너는 게임 방송 대사 라벨러다. 각 줄은 "번호\\t화자\\t대사" 형식. BJ(진행자)의 대사 중 AI 스트리머가 배울 가치가 있는 줄만 골라 JSON 배열로 라벨링한다. 시청자 대사는 BJ 대사의 trigger 로만 쓴다.
허용 situation: ${SITUATIONS.join(', ')} / 허용 emotion: ${EMOTIONS.join(', ')}.
출력은 JSON 배열만: [{"i":번호,"situation":"...","emotion":"...","trigger":"이 말을 하게 된 상황/상대 말(짧게)","quality":0~1,"tags":["..."]}] — 광고·욕설·개인정보·무의미한 추임새는 제외.`,
        messages: [{ role: 'user', content: numbered }] })
      const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
      const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)) as { i: number; situation: string; emotion?: string; trigger?: string; quality?: number; tags?: string[] }[]
      for (const a of arr) {
        const l = chunk[a.i]; if (!l) continue
        out.push({ utterance: l.text, situation: norm(a.situation, SITUATIONS, 'commentary')!, emotion: norm(a.emotion, EMOTIONS, null), trigger_text: a.trigger ?? null, genre: opts.genre ?? null, lang: /[가-힣]/.test(l.text) ? 'ko' : 'en', tags: [...(a.tags ?? []), ...(opts.bjName ? [`bj:${opts.bjName}`] : [])].slice(0, 8), quality: Math.max(0, Math.min(1, Number(a.quality ?? 0.6))) })
      }
    } catch (e) { console.warn('[mlpilot] label chunk failed', e) }
  }
  return out
}

/** MD 가이드 → 규칙 1개(원문) + Haiku 가 뽑은 예시들 */
export async function mdToRulesAndExamples(md: string, opts: { genre?: string | null; title?: string }) {
  const rule = { scope: opts.genre ? 'genre' : 'global', genre: opts.genre ?? null, kind: 'scenario', title: opts.title ?? 'MD 가이드', content: md.slice(0, 6000) }
  let examples: ExampleInput[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const s = await loadTalkSettings()
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({ model: s.labelModel, max_tokens: 2500,
        system: `아래 문서는 AI 게임 스트리머(AJ)의 말하기 가이드다. 문서에 들어있는 '예시 대사'를 추출하거나, 문서 지침을 충실히 따르는 짧은 대사 예시(한국어 위주, 10~12개)를 만든다. 허용 situation: ${SITUATIONS.join(', ')} / emotion: ${EMOTIONS.join(', ')}. JSON 배열만 출력: [{"situation":"...","emotion":"...","trigger":"상황","utterance":"대사","tags":[]}]`,
        messages: [{ role: 'user', content: md.slice(0, 12000) }] })
      const t = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
      const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)) as { situation: string; emotion?: string; trigger?: string; utterance: string; tags?: string[] }[]
      examples = arr.filter(a => a.utterance?.trim()).map(a => ({ utterance: a.utterance.trim(), situation: norm(a.situation, SITUATIONS, 'commentary')!, emotion: norm(a.emotion, EMOTIONS, null), trigger_text: a.trigger ?? null, genre: opts.genre ?? null, lang: /[가-힣]/.test(a.utterance) ? 'ko' : 'en', tags: a.tags ?? [], quality: 0.6 }))
    } catch (e) { console.warn('[mlpilot] md examples failed', e) }
  }
  return { rule, examples }
}

/** 예시 저장 (+ 소스 기록). approved 기본 false (자동화 on 이면 true) */
export async function saveExamples(list: ExampleInput[], meta: { source: string; sourceName: string; kind: string; genre?: string | null; createdBy?: string | null; approved?: boolean }) {
  const admin = createAdminClient()
  const { data: src } = await admin.from('aj_talk_sources').insert([{ kind: meta.kind, name: meta.sourceName, genre: meta.genre ?? null, rows_total: list.length, rows_imported: 0, status: 'running', created_by: meta.createdBy ?? null }] as never).select('id').maybeSingle()
  const sourceId = (src as { id: string } | null)?.id ?? null
  const rows = list.map(e => ({ source: meta.source, source_id: sourceId, genre: e.genre ?? null, game_id: e.game_id ?? null, situation: e.situation ?? 'commentary', emotion: e.emotion ?? null, trigger_text: e.trigger_text ?? null, utterance: e.utterance.slice(0, 1000), lang: e.lang ?? 'ko', tags: e.tags ?? [], quality: e.quality ?? 0.6, approved: e.approved ?? meta.approved ?? false, created_by: meta.createdBy ?? null }))
  let imported = 0
  for (let i = 0; i < rows.length; i += 200) { const { error } = await admin.from('aj_talk_examples').insert(rows.slice(i, i + 200) as never); if (!error) imported += Math.min(200, rows.length - i) }
  if (sourceId) await admin.from('aj_talk_sources').update({ rows_imported: imported, status: 'done' } as never).eq('id', sourceId)
  invalidateTalkKb()
  return { sourceId, imported, total: rows.length }
}
