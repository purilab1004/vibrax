// lib/avatar/storage.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvatarConfig } from './config'
import { validateConfig } from './config'
import { useAvatarStore } from './store'

// ─── store ↔ config bridge ──────────────────────────────────────────────────
// Read the persistable slice of the editor store into a serializable config.
export function serializeConfig(previewUrl?: string | null): AvatarConfig {
  const s = useAvatarStore.getState()
  return {
    version: 1,
    characterId: s.characterId,
    selection: s.selection,
    eyeColor: s.eyeColor,
    shader: s.shader,
    lighting: s.lighting,
    grading: s.grading,
    meshInfos: s.meshInfos,
    previewUrl: previewUrl ?? null,
  }
}

// Push a saved config into the store so the editor mounts with it.
export function applyConfig(config: AvatarConfig): void {
  useAvatarStore.setState({
    characterId: config.characterId,
    selection: config.selection,
    eyeColor: config.eyeColor,
    shader: config.shader,
    lighting: config.lighting,
    grading: config.grading,
    meshInfos: config.meshInfos,
  })
}

// ─── supabase persistence ───────────────────────────────────────────────────
export async function loadAvatarConfig(supabase: SupabaseClient, userId: string): Promise<AvatarConfig | null> {
  const { data } = await supabase.from('profiles').select('avatar_config').eq('id', userId).single()
  return validateConfig((data as { avatar_config?: unknown } | null)?.avatar_config)
}

export async function saveAvatarConfig(supabase: SupabaseClient, userId: string, config: AvatarConfig): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ avatar_config: config } as never).eq('id', userId)
  return { error: error?.message ?? null }
}

export async function uploadPreview(supabase: SupabaseClient, userId: string, blob: Blob): Promise<string | null> {
  const path = `avatar-models/${userId}.png`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) { console.error('[avatar] preview upload failed:', error); return null }
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
