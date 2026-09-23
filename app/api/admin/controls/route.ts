// 관리자 컨트롤러 표준 — 조회/저장/기본값 복원
import { requireAdmin } from '@/lib/admin/guard'
import { DEFAULT_CONTROLS, sanitizeControls } from '@/lib/controls'
import { loadControls, saveControls } from '@/lib/controls-server'

export async function GET() {
  const g = await requireAdmin(); if ('error' in g) return g.error
  return Response.json({ channels: await loadControls(), defaults: DEFAULT_CONTROLS })
}
export async function PUT(req: Request) {
  const g = await requireAdmin(); if ('error' in g) return g.error
  const b = await req.json().catch(() => null) as { channels?: unknown; reset?: boolean } | null
  const list = b?.reset ? DEFAULT_CONTROLS : sanitizeControls(b?.channels)
  await saveControls(list)
  return Response.json({ channels: list })
}
