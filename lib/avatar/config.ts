// lib/avatar/config.ts
import { CATALOG, VARIANTS_BY_ID, defaultSelection } from './catalog'
import type { PartCategory, Selection } from './catalog'

export interface AvatarConfig {
  selection: Selection
  eyeColor: string | null
  previewUrl?: string | null
  version: 1
}

export const defaultConfig = (): AvatarConfig => ({ selection: defaultSelection(), eyeColor: null, version: 1 })

const HEX = /^#[0-9a-fA-F]{6}$/

export function validateConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return null
  const inSel = (r.selection && typeof r.selection === 'object' ? r.selection : {}) as Record<string, unknown>
  const selection = {} as Selection
  for (const cat of CATALOG) {
    const id = inSel[cat.id]
    selection[cat.id as PartCategory] = typeof id === 'string' && VARIANTS_BY_ID.has(id) ? id : null
  }
  const eyeColor = typeof r.eyeColor === 'string' && HEX.test(r.eyeColor) ? r.eyeColor : null
  const previewUrl = typeof r.previewUrl === 'string' ? r.previewUrl : null
  return { selection, eyeColor, previewUrl, version: 1 }
}
