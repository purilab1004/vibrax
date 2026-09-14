// lib/controls-server.ts — 관리자 컨트롤러 설정 로드/저장 (site_settings.controls). 서버 전용.
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_CONTROLS, sanitizeControls, type ControlChannel } from '@/lib/controls'

const KEY = 'controls'
let cache: { at: number; list: ControlChannel[] } | null = null

export async function loadControls(): Promise<ControlChannel[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list
  try {
    const { data } = await createAdminClient().from('site_settings').select('value').eq('key', KEY).maybeSingle()
    const v = (data as { value?: { channels?: unknown } } | null)?.value
    const list = v?.channels ? sanitizeControls(v.channels) : DEFAULT_CONTROLS
    cache = { at: Date.now(), list }
    return list
  } catch { return cache?.list ?? DEFAULT_CONTROLS }
}
export async function saveControls(list: ControlChannel[]): Promise<void> {
  await createAdminClient().from('site_settings').upsert({ key: KEY, value: { channels: list }, updated_at: new Date().toISOString() } as never)
  cache = { at: Date.now(), list }
}
export function invalidateControls() { cache = null }
