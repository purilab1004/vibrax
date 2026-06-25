// lib/avatar/config.ts
// Serializable avatar config — the persisted slice of the editor store.
// Saved to profiles.avatar_config (jsonb) and re-applied to the store on load.
// Editor and (later) the in-game BJ companion both read the same store, so this
// config is the single source of a user's avatar appearance.
import type { CharacterId, Selection, PartCategory } from './editor/constants'
import { CHARACTERS, VARIANTS_BY_ID, defaultSelection, getCharacter } from './editor/constants'
import type { MeshInfo, Lighting, ShaderParams, GradingParams } from './store'
import { LIGHTING_DEFAULTS, SHADER_DEFAULTS, GRADING_DEFAULTS } from './store'

export type Gender = 'male' | 'female'

export interface AvatarConfig {
  version: 1
  characterId: CharacterId
  selection: Selection
  eyeColor: string | null
  shader: ShaderParams
  lighting: Lighting
  grading: GradingParams
  meshInfos: MeshInfo[]
  gender?: Gender
  previewUrl?: string | null
}

const CHARACTER_IDS = CHARACTERS.map((c) => c.id)
const HEX = /^#[0-9a-fA-F]{6}$/i
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? v : fallback)

export function defaultConfig(characterId: CharacterId = 'male1'): AvatarConfig {
  return {
    version: 1,
    characterId,
    selection: defaultSelection(getCharacter(characterId).catalog),
    eyeColor: null,
    shader: { ...SHADER_DEFAULTS },
    lighting: { ...LIGHTING_DEFAULTS },
    grading: { ...GRADING_DEFAULTS },
    meshInfos: [],
  }
}

// Normalize untrusted JSON (DB row) into a usable v1 config, or null if unusable.
// Unknown variant ids in selection are dropped to null; out-of-shape fields fall back to defaults.
export function validateConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return null

  const characterId = (CHARACTER_IDS as string[]).includes(r.characterId as string)
    ? (r.characterId as CharacterId)
    : 'male1'
  const catalog = getCharacter(characterId).catalog

  const inSel = (r.selection && typeof r.selection === 'object' ? r.selection : {}) as Record<string, unknown>
  const selection = {} as Selection
  for (const cat of catalog) {
    const id = inSel[cat.id]
    selection[cat.id as PartCategory] = typeof id === 'string' && VARIANTS_BY_ID.has(id) ? id : null
  }

  const s = (r.shader ?? {}) as Record<string, unknown>
  const shader: ShaderParams = {
    outlineWidth: num(s.outlineWidth, SHADER_DEFAULTS.outlineWidth),
    shadingToonyFactor: num(s.shadingToonyFactor, SHADER_DEFAULTS.shadingToonyFactor),
  }

  const l = (r.lighting ?? {}) as Record<string, unknown>
  const lighting: Lighting = {
    ambient: num(l.ambient, LIGHTING_DEFAULTS.ambient),
    keyIntensity: num(l.keyIntensity, LIGHTING_DEFAULTS.keyIntensity),
    keyAngle: num(l.keyAngle, LIGHTING_DEFAULTS.keyAngle),
  }

  const g = (r.grading ?? {}) as Record<string, unknown>
  const grading: GradingParams = {
    brightness: num(g.brightness, GRADING_DEFAULTS.brightness),
    contrast: num(g.contrast, GRADING_DEFAULTS.contrast),
    hue: num(g.hue, GRADING_DEFAULTS.hue),
    saturation: num(g.saturation, GRADING_DEFAULTS.saturation),
  }

  const meshInfos: MeshInfo[] = Array.isArray(r.meshInfos)
    ? (r.meshInfos as unknown[]).flatMap((m) => {
        if (!m || typeof m !== 'object') return []
        const mi = m as Record<string, unknown>
        if (typeof mi.name !== 'string') return []
        return [{
          name: mi.name,
          label: typeof mi.label === 'string' ? mi.label : mi.name,
          visible: mi.visible !== false,
          litColor: isHex(mi.litColor) ? mi.litColor : '#ffffff',
          shadeColor: isHex(mi.shadeColor) ? mi.shadeColor : '#888888',
        }]
      })
    : []

  const eyeColor = isHex(r.eyeColor) ? r.eyeColor : null
  const gender: Gender | undefined = r.gender === 'female' ? 'female' : r.gender === 'male' ? 'male' : undefined
  const previewUrl = typeof r.previewUrl === 'string' ? r.previewUrl : null

  return { version: 1, characterId, selection, eyeColor, shader, lighting, grading, meshInfos, gender, previewUrl }
}
