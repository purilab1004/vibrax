// 약관 관리 API — 문서별 버전 목록, 새 버전 저장(초안/게시), 게시 전환, 기본값(정적) 불러오기
import { requireAdmin } from '@/lib/admin/guard'
import { LEGAL_STATIC } from '@/lib/legal/static'
import { revalidatePath } from 'next/cache'

const KEYS = Object.keys(LEGAL_STATIC)
const PATHS: Record<string, string> = { terms: '/terms', privacy: '/privacy', refund: '/refund', marketing: '/marketing-consent' }

export async function GET(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const url = new URL(req.url); const key = url.searchParams.get('key') ?? 'terms'; const lang = url.searchParams.get('lang') ?? 'ko'
  if (!KEYS.includes(key)) return Response.json({ error: 'bad key' }, { status: 400 })
  const { data, error } = await g.admin.from('legal_docs').select('id,version,title,updated,sections,published,note,created_at').eq('key', key).eq('lang', lang).order('version', { ascending: false })
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message), keys: KEYS.map(k => ({ key: k, label: LEGAL_STATIC[k].label })), fallback: LEGAL_STATIC[key][lang as 'ko' | 'en'] }, { status: 500 })
  return Response.json({ keys: KEYS.map(k => ({ key: k, label: LEGAL_STATIC[k].label })), versions: data ?? [], fallback: LEGAL_STATIC[key][lang as 'ko' | 'en'] })
}
// POST { key, lang, title, updated, sections, publish?: boolean, note? } → 새 버전 생성 (publish 면 기존 게시본 해제)
export async function POST(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { key?: string; lang?: string; title?: string; updated?: string; sections?: { h: string; p: string[] }[]; publish?: boolean; note?: string } | null
  if (!b?.key || !KEYS.includes(b.key) || !b.title || !Array.isArray(b.sections)) return Response.json({ error: 'bad request' }, { status: 400 })
  const lang = b.lang === 'en' ? 'en' : 'ko'
  const { data: last } = await g.admin.from('legal_docs').select('version').eq('key', b.key).eq('lang', lang).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = ((last as { version?: number } | null)?.version ?? 0) + 1
  if (b.publish) await g.admin.from('legal_docs').update({ published: false } as never).eq('key', b.key).eq('lang', lang)
  const { data, error } = await g.admin.from('legal_docs').insert([{ key: b.key, lang, version, title: b.title.trim(), updated: b.updated?.trim() || null, sections: b.sections.map(s => ({ h: String(s.h ?? '').trim(), p: (s.p ?? []).map(x => String(x)).filter(x => x.trim()) })).filter(s => s.h || s.p.length), published: !!b.publish, note: b.note ?? null, created_by: g.user.id }] as never).select('id,version').maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (b.publish) { revalidatePath(PATHS[b.key]); }
  return Response.json({ ok: true, version: (data as { version: number } | null)?.version ?? version })
}
// PATCH { id, published: true } → 해당 버전 게시 (같은 key/lang 의 다른 버전 해제)
export async function PATCH(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { id?: string; published?: boolean } | null
  if (!b?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { data: row } = await g.admin.from('legal_docs').select('key,lang').eq('id', b.id).maybeSingle()
  if (!row) return Response.json({ error: 'not found' }, { status: 404 })
  const r = row as { key: string; lang: string }
  if (b.published !== false) await g.admin.from('legal_docs').update({ published: false } as never).eq('key', r.key).eq('lang', r.lang)
  await g.admin.from('legal_docs').update({ published: b.published !== false } as never).eq('id', b.id)
  revalidatePath(PATHS[r.key] ?? '/terms')
  return Response.json({ ok: true })
}
