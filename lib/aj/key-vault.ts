// 발급한 AJ 키 원문을 서버 비밀값으로 암호화해 보관 → 주인이 내 정보에서 다시 보고 복사할 수 있게
// 저장 위치: auth app_metadata.ajk { [keyId]: 암호문 } (관리자만 쓸 수 있는 칸 · 테이블 변경 없음)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const secret = () => createHash('sha256').update('aj-key-vault:' + (process.env.AJ_KEY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest()

export function sealKey(raw: string): string {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', secret(), iv)
  const enc = Buffer.concat([c.update(raw, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url')
}
export function openKey(sealed: string): string | null {
  try {
    const b = Buffer.from(sealed, 'base64url'), d = createDecipheriv('aes-256-gcm', secret(), b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  } catch { return null }
}

async function vault(userId: string): Promise<Record<string, string>> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId)
  return ((data?.user?.app_metadata ?? {}) as { ajk?: Record<string, string> }).ajk ?? {}
}
export async function storeKey(userId: string, keyId: string, raw: string) {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  const meta = (data?.user?.app_metadata ?? {}) as Record<string, unknown>
  const ajk = { ...((meta.ajk as Record<string, string>) ?? {}), [keyId]: sealKey(raw) }
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...meta, ajk } })
}
export async function dropKey(userId: string, keyId: string) {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  const meta = (data?.user?.app_metadata ?? {}) as Record<string, unknown>
  const ajk = { ...((meta.ajk as Record<string, string>) ?? {}) }
  if (!(keyId in ajk)) return
  delete ajk[keyId]
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...meta, ajk } })
}
export async function revealKey(userId: string, keyId: string): Promise<string | null> {
  const s = (await vault(userId))[keyId]
  return s ? openKey(s) : null
}
export async function storedKeyIds(userId: string): Promise<string[]> { return Object.keys(await vault(userId)) }
