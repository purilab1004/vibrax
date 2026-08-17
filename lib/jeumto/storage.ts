// lib/jeumto/storage.ts — Supabase 저장/불러오기 (profiles.avatar_config + avatars 버킷)
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvatarConfig, JeumtoCharacterData } from './config'
import { validateConfig, isJeumtoCharacter } from './config'

export async function loadAvatarConfig(supabase: SupabaseClient, userId: string): Promise<AvatarConfig | null> {
  const { data } = await supabase.from('profiles').select('avatar_config').eq('id', userId).single()
  return validateConfig((data as { avatar_config?: unknown } | null)?.avatar_config)
}

export async function saveAvatarConfig(supabase: SupabaseClient, userId: string, config: AvatarConfig): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ avatar_config: config } as never).eq('id', userId)
  return { error: error?.message ?? null }
}

function publicUrl(supabase: SupabaseClient, path: string): string {
  // 같은 경로에 덮어써도 CDN/브라우저가 옛 파일을 캐시하지 않도록 버전 쿼리를 붙인다
  return `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
}

export async function uploadPreview(supabase: SupabaseClient, userId: string, blob: Blob, variant: '' | 'blink' = ''): Promise<string | null> {
  const path = `avatar-models/${userId}${variant ? '.' + variant : ''}.png`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) { console.error('[jeumto] preview upload failed:', error); return null }
  return publicUrl(supabase, path)
}

export async function uploadCharacterData(supabase: SupabaseClient, userId: string, data: JeumtoCharacterData): Promise<{ url: string | null; error: string | null }> {
  const path = `avatar-models/${userId}.jeumto.json`
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'application/json' })
  if (error) { console.error('[jeumto] data upload failed:', error); return { url: null, error: error.message } }
  return { url: publicUrl(supabase, path), error: null }
}

// 캐시: 같은 페이지에서 여러 컴포넌트가 같은 캐릭터를 요청해도 한 번만 받는다
const dataCache = new Map<string, Promise<JeumtoCharacterData | null>>()
export function fetchCharacterData(url: string): Promise<JeumtoCharacterData | null> {
  let p = dataCache.get(url)
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) return null
      const json: unknown = await r.json()
      return isJeumtoCharacter(json) ? json : null
    }).catch(() => null)
    dataCache.set(url, p)
  }
  return p
}
