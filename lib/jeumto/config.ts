// lib/jeumto/config.ts
// 점토(jeumto) 아바타 — profiles.avatar_config(jsonb)에 저장되는 "작은" 설정.
// 캐릭터 본체(정점 오프셋·페인트·파츠)는 크기가 커서 Storage(avatars 버킷)에 JSON으로 올리고
// 여기엔 그 URL + 프리뷰 PNG URL + 이름/목소리만 둔다. 게임 목록 쿼리가 profiles(avatar_config)를
// 함께 읽으므로 이 객체는 가볍게 유지해야 한다.
export type Gender = 'male' | 'female'

export interface AvatarConfig {
  format: 'jeumto'
  version: 1
  name: string
  voice: Gender          // TTS 목소리
  previewUrl: string | null
  blinkUrl?: string | null // 눈 감은 프레임 PNG (카드 깜빡임용)
  talkUrl?: string | null  // 입 벌린 프레임 PNG (카드 말하기용)
  dataUrl: string | null // *.jeumto.json (Storage public URL)
  previewVersion?: number // 5 = 투명·정상 비율 + 깜빡임·말하기 프레임 (없으면 옛 어두운 배경 → 프로필에서 자동 재생성)
}

/** 점토 에디터가 직렬화하는 캐릭터 데이터(character.serialize()) — 형태만 느슨하게 */
export interface JeumtoCharacterData {
  format: 'jeumto-character'
  version: number
  name?: string
  clay: Record<string, unknown>
  parts: unknown[]
  rig?: Record<string, unknown>
  [k: string]: unknown
}

// DB row(신뢰 불가) → 사용 가능한 config, 아니면 null. 구 VRM 포맷(version:1 + characterId)은 null.
export function validateConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.format !== 'jeumto' || r.version !== 1) return null
  return {
    format: 'jeumto',
    version: 1,
    name: typeof r.name === 'string' && r.name.trim() ? r.name : '내 점토',
    voice: r.voice === 'male' ? 'male' : 'female',
    previewUrl: typeof r.previewUrl === 'string' ? r.previewUrl : null,
    blinkUrl: typeof r.blinkUrl === 'string' ? r.blinkUrl : null,
    talkUrl: typeof r.talkUrl === 'string' ? r.talkUrl : null,
    dataUrl: typeof r.dataUrl === 'string' ? r.dataUrl : null,
    previewVersion: typeof r.previewVersion === 'number' ? r.previewVersion : undefined,
  }
}

export function isJeumtoCharacter(raw: unknown): raw is JeumtoCharacterData {
  return !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).format === 'jeumto-character'
}

/** DB row 의 avatar_config 에서 프리뷰 URL 만 — 구 포맷은 null (옛 VRM 프리뷰가 남아 보이지 않도록) */
export function avatarPreviewUrl(raw: unknown): string | null {
  return validateConfig(raw)?.previewUrl ?? null
}

/** 카드용: 프리뷰 + 깜빡임 프레임 URL (구 포맷은 null) */
export interface AvatarFrames { url: string; blinkUrl: string | null; talkUrl: string | null }
export function avatarFrames(raw: unknown): AvatarFrames | null {
  const c = validateConfig(raw)
  return c?.previewUrl ? { url: c.previewUrl, blinkUrl: c.blinkUrl ?? null, talkUrl: c.talkUrl ?? null } : null
}
