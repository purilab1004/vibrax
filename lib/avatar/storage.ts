// lib/avatar/storage.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { AvatarConfig, validateConfig } from './config'

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
  if (error) return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
