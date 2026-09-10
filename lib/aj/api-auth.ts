// lib/aj/api-auth.ts — AJ 외부 API 인증 (Bearer vxaj_… 키) + CORS + 할당량. 서버 전용.
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/ratelimit'
import type { AvatarConfig } from '@/lib/jeumto/config'

export const API_KEY_PREFIX = 'vxaj_'
export type Scope = 'chat' | 'profile' | 'tts'
export type KeyKind = 'chrome' | 'api'

export interface ApiSettings { chromeDailyQuota: number; apiDailyQuota: number; perMinute: number; maxKeysPerUser: number; creditsPerChat: number; creditsPerTts: number; minBalanceToIssue: number }
// 크롬 확장 키 = 무료(일 200회, 확장 Origin 전용) · 개발자 API 키 = 프롬코인 과금(채팅 1, TTS 2)
export const DEFAULT_API: ApiSettings = { chromeDailyQuota: 200, apiDailyQuota: 5000, perMinute: 30, maxKeysPerUser: 5, creditsPerChat: 1, creditsPerTts: 2, minBalanceToIssue: 1 }
let cache: { at: number; v: ApiSettings } | null = null
export async function loadApiSettings(): Promise<ApiSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v
  try {
    const { data } = await createAdminClient().from('site_settings').select('value').eq('key', 'aj_api').maybeSingle()
    const v = { ...DEFAULT_API, ...(((data as { value?: Partial<ApiSettings> } | null)?.value) ?? {}) }
    cache = { at: Date.now(), v }; return v
  } catch { return DEFAULT_API }
}

export const hashKey = (raw: string) => createHash('sha256').update(raw).digest('hex')
export function generateKey(): { raw: string; prefix: string; hash: string } {
  const raw = API_KEY_PREFIX + randomBytes(24).toString('hex')
  return { raw, prefix: raw.slice(0, 12), hash: hashKey(raw) }
}

// ── CORS: 브라우저(크롬 확장·다른 사이트)에서 직접 호출 가능하게 ──
export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}
export const preflight = () => new Response(null, { status: 204, headers: CORS })
export const apiJson = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, { ...init, headers: { ...CORS, ...(init.headers ?? {}) } })
export const apiError = (status: number, error: string, extra: Record<string, unknown> = {}) => apiJson({ error, ...extra }, { status })

export interface ApiIdentity {
  keyId: string
  kind: KeyKind
  scopes: Scope[]
  userId: string
  username: string | null
  agentName: string | null      // 회원이 지은 AJ 이름
  agentPersona: string | null   // 성격·말투
  avatar: AvatarConfig | null
  callsToday: number
  dailyQuota: number
  charged: number               // 이번 호출에 차감된 프롬코인 (chrome 키는 0)
  chargeRef: string | null      // 차감 원장 ref — 실패 시 refundApiCharge() 로 환불
  balance: number | null        // 차감 후 잔액 (api 키만)
}

/** Bearer 키 검증 → 회원 정보. 실패 시 Response(401/403/429). 성공 시 호출 1건을 할당량에 기록한다. */
export async function authenticateApi(req: Request, scope: Scope, opts: { count?: boolean } = {}): Promise<ApiIdentity | Response> {
  const auth = req.headers.get('authorization') ?? ''
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (new URL(req.url).searchParams.get('key') ?? '')
  if (!raw.startsWith(API_KEY_PREFIX) || raw.length < 30) return apiError(401, 'missing or malformed api key')
  const admin = createAdminClient()
  const { data: key, error } = await admin.from('aj_api_keys').select('id,user_id,kind,scopes,revoked_at,calls_today,calls_day').eq('key_hash', hashKey(raw)).maybeSingle()
  if (error) return apiError(503, 'api not ready (migration missing)')
  const k = key as { id: string; user_id: string; kind: KeyKind; scopes: string[]; revoked_at: string | null; calls_today: number; calls_day: string | null } | null
  if (!k || k.revoked_at) return apiError(401, 'invalid or revoked api key')
  if (!k.scopes.includes(scope)) return apiError(403, `scope '${scope}' not granted`)
  const s = await loadApiSettings()
  // 크롬 확장 키는 브라우저 확장에서 온 요청만 (Origin: chrome-extension:// | moz-extension://). 그 외 사용은 유료 API 키로.
  if (k.kind === 'chrome') {
    const origin = req.headers.get('origin') ?? ''
    if (!/^(chrome|moz|safari-web)-extension:\/\//.test(origin)) return apiError(403, 'this key works only inside the browser extension — use a developer API key for other clients')
    // 웹스토어 게시 후 CHROME_EXTENSION_IDS(쉼표 구분) 를 설정하면 공식 확장 ID 에서 온 요청만 허용
    const allowed = (process.env.CHROME_EXTENSION_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean)
    if (allowed.length && !allowed.some(idv => origin === `chrome-extension://${idv}`)) return apiError(403, 'unofficial extension build')
  }
  if (!rateLimit(`ajapi:${k.id}`, s.perMinute, 60_000).ok) return apiError(429, 'rate limited', { perMinute: s.perMinute })
  const dailyQuota = k.kind === 'chrome' ? s.chromeDailyQuota : s.apiDailyQuota
  let callsToday = k.calls_day === new Date().toISOString().slice(0, 10) ? k.calls_today : 0
  let charged = 0, balance: number | null = null, chargeRef: string | null = null
  if (opts.count !== false) {
    const { data: n, error: hitErr } = await admin.rpc('aj_api_hit', { p_key: k.id, p_daily_limit: dailyQuota } as never)
    if (hitErr) return hitErr.message.includes('QUOTA_EXCEEDED') ? apiError(429, 'daily quota exceeded', { dailyQuota }) : apiError(401, 'invalid api key')
    callsToday = Number(n ?? callsToday + 1)
    // 개발자 API 키 = 프롬코인 과금 (chat 1 · tts 2, 설정으로 조정)
    if (k.kind === 'api') {
      charged = scope === 'tts' ? s.creditsPerTts : scope === 'chat' ? s.creditsPerChat : 0
      if (charged > 0) {
        chargeRef = `api:${k.id}:${crypto.randomUUID()}`
        const { data: bal, error: spendErr } = await admin.rpc('spend_credits_for', { p_user_id: k.user_id, p_amount: charged, p_ref: chargeRef, p_reason: 'api' } as never)
        if (spendErr) return spendErr.message.includes('INSUFFICIENT_CREDITS') ? apiError(402, 'insufficient prompt credits', { charge: 'https://vibrexcup.com/credits', creditsPerCall: charged }) : apiError(500, 'billing failed')
        balance = Number(bal)
      }
    }
  }
  const [{ data: prof }, { data: au }] = await Promise.all([
    admin.from('profiles').select('username,agent_name,avatar_config').eq('id', k.user_id).maybeSingle(),
    admin.auth.admin.getUserById(k.user_id),
  ])
  const p = prof as { username: string | null; agent_name: string | null; avatar_config: AvatarConfig | null } | null
  const meta = (au?.user?.user_metadata ?? {}) as { agent_name?: string; agent_persona?: string }
  return {
    keyId: k.id, kind: k.kind, scopes: k.scopes as Scope[], userId: k.user_id,
    username: p?.username ?? null,
    agentName: (meta.agent_name ?? p?.agent_name ?? p?.avatar_config?.name ?? '').trim() || null,
    agentPersona: (meta.agent_persona ?? '').trim() || null,
    avatar: p?.avatar_config ?? null,
    callsToday, dailyQuota, charged, balance, chargeRef,
  }
}

/** LLM/TTS 실패 시 이번 호출의 차감을 되돌린다 (양수 api 행, ref 에 :refund) */
export async function refundApiCharge(id: ApiIdentity): Promise<void> {
  if (!id.charged || !id.chargeRef) return
  try { await createAdminClient().from('credit_ledger').insert([{ user_id: id.userId, amount: id.charged, reason: 'api', ref_id: `${id.chargeRef}:refund` }] as never) } catch (e) { console.error('[aj api] refund failed', e) }
}
