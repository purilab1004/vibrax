// app/api/aj-keys/route.ts — 내 AJ 키 관리 (로그인 세션)
// GET → { keys[], settings, balance }   POST { kind:'chrome'|'api', name? } → { key(원문, 1회만), row }   DELETE { id } → 폐기
// chrome 키: 무료, 회원당 1개(활성), 확장 Origin 에서만 동작 · api 키: 프롬코인 잔액이 있어야 발급, 호출마다 차감
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateKey, loadApiSettings, type KeyKind } from '@/lib/aj/api-auth'
import { rateLimit, tooMany } from '@/lib/security/ratelimit'
import { storeKey, dropKey, revealKey, storedKeyIds } from '@/lib/aj/key-vault'

export const runtime = 'nodejs'

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: Request) {
  const user = await me(); if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  // ?reveal=<keyId> → 내 키 원문 (보관된 것만)
  const rid = new URL(req.url).searchParams.get('reveal')
  if (rid) {
    if (!rateLimit(`ajreveal:${user.id}`, 30, 60_000).ok) return tooMany()
    const { data: row } = await createAdminClient().from('aj_api_keys').select('id').eq('id', rid).eq('user_id', user.id).is('revoked_at', null).maybeSingle()
    const key = row ? await revealKey(user.id, rid) : null
    return key ? Response.json({ key }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: '이 키는 원문이 보관되지 않았어요 (예전에 발급한 키). 폐기 후 새로 발급하면 언제든 다시 볼 수 있어요.' }, { status: 404 })
  }
  const admin = createAdminClient()
  const [{ data: keys, error }, { data: bal }, settings] = await Promise.all([
    admin.from('aj_api_keys').select('id,kind,name,prefix,scopes,calls_total,calls_today,calls_day,last_used_at,revoked_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    admin.from('credit_ledger').select('amount').eq('user_id', user.id).limit(5000),
    loadApiSettings(),
  ])
  if (error) return Response.json({ ready: false, keys: [], settings, balance: 0, error: 'migration missing' })
  const balance = ((bal ?? []) as { amount: number }[]).reduce((a, r) => a + r.amount, 0)
  const stored = new Set(await storedKeyIds(user.id).catch(() => [] as string[]))
  return Response.json({ ready: true, keys: ((keys ?? []) as { id: string }[]).map(k => ({ ...k, stored: stored.has(k.id) })), settings, balance })
}

export async function POST(req: Request) {
  const user = await me(); if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!rateLimit(`ajkeys:${user.id}`, 10, 3600_000).ok) return tooMany()
  const body = await req.json().catch(() => null) as { kind?: KeyKind; name?: string } | null
  const kind: KeyKind = body?.kind === 'chrome' ? 'chrome' : 'api'
  const name = (typeof body?.name === 'string' ? body.name : '').trim().slice(0, 40) || (kind === 'chrome' ? 'Chrome 확장' : 'API')
  const admin = createAdminClient()
  const s = await loadApiSettings()
  const { data: active, error } = await admin.from('aj_api_keys').select('id,kind').eq('user_id', user.id).is('revoked_at', null)
  if (error) return Response.json({ error: 'api not ready — db/migrations/2026-09-10-aj-api-keys.sql 을 실행하세요' }, { status: 503 })
  const rows = (active ?? []) as { id: string; kind: KeyKind }[]
  if (kind === 'chrome' && rows.some(r => r.kind === 'chrome')) return Response.json({ error: '크롬 확장 키는 1개만 가질 수 있어요. 기존 키를 폐기한 뒤 다시 발급하세요.' }, { status: 409 })
  if (rows.length >= s.maxKeysPerUser) return Response.json({ error: `키는 최대 ${s.maxKeysPerUser}개까지예요` }, { status: 409 })
  if (kind === 'api') {
    const { data: bal } = await admin.from('credit_ledger').select('amount').eq('user_id', user.id).limit(5000)
    const balance = ((bal ?? []) as { amount: number }[]).reduce((a, r) => a + r.amount, 0)
    if (balance < s.minBalanceToIssue) return Response.json({ error: `개발자 API 키는 프롬코인이 있어야 발급돼요 (현재 ${balance}). 충전 후 다시 시도하세요.`, charge: '/credits' }, { status: 402 })
  }
  const k = generateKey()
  const scopes = kind === 'chrome' ? ['chat', 'profile'] : ['chat', 'profile', 'tts', 'build']
  const { data: row, error: insErr } = await admin.from('aj_api_keys').insert([{ user_id: user.id, kind, name, prefix: k.prefix, key_hash: k.hash, scopes }] as never).select('id,kind,name,prefix,scopes,created_at').maybeSingle()
  if (insErr || !row) return Response.json({ error: insErr?.message ?? 'insert failed' }, { status: 500 })
  try { await storeKey(user.id, (row as { id: string }).id, k.raw) } catch (e) { console.error('[aj-keys] vault store failed', e) }
  return Response.json({ key: k.raw, row })
}

export async function DELETE(req: Request) {
  const user = await me(); if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return Response.json({ error: 'bad request' }, { status: 400 })
  const { error } = await createAdminClient().from('aj_api_keys').update({ revoked_at: new Date().toISOString() } as never).eq('id', body.id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  try { await dropKey(user.id, body.id) } catch { /* 보관본 정리 실패는 무시 (키는 이미 폐기) */ }
  return Response.json({ ok: true })
}
