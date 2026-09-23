// 보안 · 서버 현황 — 트래픽(시간대별 PV/세션), 에러율, 웹훅 실패, 보안 이벤트, 이상 트래픽(해시 IP 기준), 코인 원장 무결성
import { requireAdmin } from '@/lib/admin/guard'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const now = Date.now(); const since24 = new Date(now - 24 * 3600_000).toISOString(); const since7 = new Date(now - 7 * 864e5).toISOString()
  const [{ data: v24 }, { data: e24 }, { data: sec }, { data: pe }, { data: llm }, ledgerBad, { count: ledgerCount }, { data: lastLedger }] = await Promise.all([
    g.admin.from('visits').select('created_at,session_id,path,ip_hash,device').gte('created_at', since24).limit(50000),
    g.admin.from('app_errors').select('created_at,source,level').gte('created_at', since24).limit(20000),
    g.admin.from('security_events').select('id,kind,severity,ip_hash,user_id,path,detail,created_at').gte('created_at', since7).order('created_at', { ascending: false }).limit(300),
    g.admin.from('payment_events').select('processed,error,created_at').gte('created_at', since7).limit(5000),
    g.admin.from('llm_usage').select('created_at,cost_usd').gte('created_at', since24).limit(20000),
    g.admin.rpc('game_coin_ledger_verify' as never).then(r => r, () => ({ data: null, error: { message: 'no ledger' } })),
    g.admin.from('game_coin_ledger').select('seq', { count: 'exact', head: true }),
    g.admin.from('game_coin_ledger').select('seq,hash,created_at').order('seq', { ascending: false }).limit(1),
  ])
  const { data: blocks } = await g.admin.from('chain_blocks').select('height,prev_hash,merkle_root,from_seq,to_seq,tx_count,block_hash,sealed_at').order('height', { ascending: false }).limit(20).then(r => r, () => ({ data: null }))
  const visits = (v24 ?? []) as { created_at: string; session_id: string | null; path: string; ip_hash: string | null; device: string | null }[]
  const errs = (e24 ?? []) as { created_at: string; source: string; level: string }[]
  const hours = Array.from({ length: 24 }, (_, i) => { const t = new Date(now - (23 - i) * 3600_000); return { h: `${t.getHours()}시`, key: t.toISOString().slice(0, 13), pv: 0, sessions: new Set<string>(), errors: 0, llm: 0 } })
  const idx = new Map(hours.map((h, i) => [h.key, i]))
  for (const v of visits) { const i = idx.get(v.created_at.slice(0, 13)); if (i != null) { hours[i].pv++; if (v.session_id) hours[i].sessions.add(v.session_id) } }
  for (const e of errs) { const i = idx.get(e.created_at.slice(0, 13)); if (i != null) hours[i].errors++ }
  for (const l of (llm ?? []) as { created_at: string }[]) { const i = idx.get(l.created_at.slice(0, 13)); if (i != null) hours[i].llm++ }
  // 이상 트래픽: 같은 해시IP 가 1시간 내 300 PV 이상 / 세션당 500 PV 이상
  const byIp: Record<string, number> = {}; const bySess: Record<string, number> = {}
  for (const v of visits) { if (v.ip_hash) byIp[v.ip_hash] = (byIp[v.ip_hash] ?? 0) + 1; if (v.session_id) bySess[v.session_id] = (bySess[v.session_id] ?? 0) + 1 }
  const topIps = Object.entries(byIp).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ ip_hash: k, pv: v, suspicious: v >= 800 }))
  const suspiciousSessions = Object.entries(bySess).filter(([, n]) => n >= 500).length
  const pes = (pe ?? []) as { processed: boolean; error: string | null }[]
  const secRows = (sec ?? []) as { id: string; kind: string; severity: string; ip_hash: string | null; user_id: string | null; path: string | null; detail: unknown; created_at: string }[]
  return Response.json({
    hours: hours.map(h => ({ h: h.h, pv: h.pv, sessions: h.sessions.size, errors: h.errors, llm: h.llm })),
    totals: { pv24: visits.length, sessions24: new Set(visits.map(v => v.session_id).filter(Boolean)).size, errors24: errs.length, errorRate: visits.length ? errs.length / visits.length : 0, llm24: (llm ?? []).length, llmCost24: ((llm ?? []) as { cost_usd: number }[]).reduce((a, r) => a + Number(r.cost_usd), 0), webhookFail7: pes.filter(p => !p.processed || p.error).length, webhook7: pes.length, secHigh7: secRows.filter(s => s.severity === 'high').length, sec7: secRows.length, suspiciousSessions, topIps },
    security: secRows,
    blocks: blocks ?? [],
    ledger: { count: ledgerCount ?? 0, brokenAt: (ledgerBad as { data?: number | null } | null)?.data ?? null, available: !(ledgerBad as { error?: unknown } | null)?.error, last: (lastLedger as { seq: number; hash: string; created_at: string }[] | null)?.[0] ?? null },
    modules: { paddleWebhookIpAllowlist: true, paddleSignature: true, adminIpAllowlistMaintenance: false, rlsAllTables: true, serviceRoleServerOnly: true, noPrivateKeysInApp: true, ipStoredHashedOnly: true },
  })
}

// 블록 봉인 (관리자 수동; 운영에선 cron 으로 10분마다)
export async function POST() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const { data, error } = await g.admin.rpc('chain_seal_block' as never)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ height: data })
}
