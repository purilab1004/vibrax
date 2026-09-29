// 게임 저장 슬롯 — 게임 하나당 최대 3칸. game_saves 한 행의 data 안에 슬롯을 담는다(테이블 변경 없음).
//   새 형식: { __vbxSlots: 1, slots: { "1": { data, at, label }, "2": ..., "3": ... } }
//   옛 형식: { 저장키: 값, ... } — 그대로 1번 슬롯으로 읽는다
export const MAX_SLOTS = 3
export type SlotNo = 1 | 2 | 3
export type SlotEntry = { data: Record<string, string>; at: string; label: string | null }
export type SlotMap = Partial<Record<'1' | '2' | '3', SlotEntry>>
export type SlotSummary = { slot: SlotNo; at: string; label: string | null; bytes: number }

export const isSlotNo = (v: unknown): v is SlotNo => v === 1 || v === 2 || v === 3

export function parseSlots(raw: unknown, updatedAt?: string | null): SlotMap {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  if (r.__vbxSlots && r.slots && typeof r.slots === 'object') {
    const out: SlotMap = {}
    for (const k of ['1', '2', '3'] as const) {
      const e = (r.slots as Record<string, SlotEntry | undefined>)[k]
      if (e && e.data && typeof e.data === 'object' && Object.keys(e.data).length) out[k] = e
    }
    return out
  }
  // 옛 저장 — 통째로 1번 슬롯
  if (Object.keys(r).length === 0) return {}
  return { '1': { data: r as Record<string, string>, at: updatedAt ?? new Date(0).toISOString(), label: labelOf(r as Record<string, string>) } }
}

export const packSlots = (slots: SlotMap) => ({ __vbxSlots: 1, slots })

export function summarize(slots: SlotMap): (SlotSummary | null)[] {
  return ([1, 2, 3] as SlotNo[]).map((n) => {
    const e = slots[String(n) as '1']
    return e ? { slot: n, at: e.at, label: e.label, bytes: JSON.stringify(e.data).length } : null
  })
}

/** 가장 최근에 저장한 슬롯 */
export function latestSlot(slots: SlotMap): SlotNo | null {
  let best: SlotNo | null = null, bestAt = ''
  for (const n of [1, 2, 3] as SlotNo[]) {
    const e = slots[String(n) as '1']
    if (e && e.at > bestAt) { best = n; bestAt = e.at }
  }
  return best
}

/** 저장 데이터에서 레벨·스테이지를 찾아 "Lv.12" 같은 짧은 이름표를 만든다 (못 찾으면 null) */
export function labelOf(data: Record<string, string>): string | null {
  const keys = ['level', 'lv', 'stage', 'round', 'wave', 'floor', 'chapter']
  const names: Record<string, string> = { level: 'Lv.', lv: 'Lv.', stage: '스테이지 ', round: '라운드 ', wave: '웨이브 ', floor: '층 ', chapter: '챕터 ' }
  const seen = new Set<unknown>()
  const find = (o: unknown, depth: number): string | null => {
    if (!o || typeof o !== 'object' || depth > 3 || seen.has(o)) return null
    seen.add(o)
    for (const k of keys) {
      const v = (o as Record<string, unknown>)[k]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000) return k === 'floor' ? `${v}층` : `${names[k]}${v}`
    }
    for (const v of Object.values(o as Record<string, unknown>)) {
      const hit = find(v, depth + 1)
      if (hit) return hit
    }
    return null
  }
  for (const v of Object.values(data)) {
    if (typeof v !== 'string' || v.length < 2 || (v[0] !== '{' && v[0] !== '[')) continue
    try { const hit = find(JSON.parse(v), 0); if (hit) return hit } catch { /* 문자열 값 */ }
  }
  return null
}
