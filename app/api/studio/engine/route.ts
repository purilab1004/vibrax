// 관리자 — 스튜디오 생성 엔진 정보: Max 워커 사용 가능 여부 + 마지막으로 받은 Max 구독 사용량(5시간·7일 창)
import { requireAdmin } from '@/lib/admin/guard'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const [{ data: usage }, { data: lastJob }] = await Promise.all([
    g.admin.from('site_settings').select('value,updated_at').eq('key', 'max_usage').maybeSingle(),
    g.admin.from('studio_jobs').select('status,created_at,model').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return Response.json({
    maxWorker: process.env.MAX_WORKER === '1',
    usage: (usage as { value: unknown; updated_at: string } | null) ?? null,
    lastJob: lastJob ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
