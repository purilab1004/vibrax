// Modal GPU 서버리스(scripts/modal/trellis3d.py) 호출 공용 — 서버 전용
// 작업은 spawn → 폴링. 요청자·차감 내역은 서버 비밀값으로 서명한 token 에 담아 들고 다닌다(별도 테이블 없음).
import { createHmac, timingSafeEqual } from 'crypto'

export const modalUrl = () => (process.env.MODAL_3D_URL ?? '').replace(/\/$/, '')
export const modalReady = () => !!(modalUrl() && process.env.MODAL_3D_TOKEN)
export const modalAuth = () => ({ Authorization: `Bearer ${process.env.MODAL_3D_TOKEN}` })

export async function modalSubmit(body: Record<string, unknown>): Promise<{ id?: string; detail?: unknown; ok: boolean }> {
  const r = await fetch(`${modalUrl()}/submit`, { method: 'POST', headers: { ...modalAuth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})) as { id?: string; detail?: unknown }
  return { ...j, ok: r.ok && !!j.id }
}
export async function modalStatus(id: string): Promise<{ status?: string; error?: string; images?: number; thumb?: boolean; seed?: number } | null> {
  return fetch(`${modalUrl()}/result/${id}`, { headers: modalAuth() }).then((r) => r.json()).catch(() => null)
}
export async function modalFile(id: string, part: string): Promise<Buffer | null> {
  const r = await fetch(`${modalUrl()}/result/${id}/${part}`, { headers: modalAuth() }).catch(() => null)
  return r?.ok ? Buffer.from(await r.arrayBuffer()) : null
}

const secret = (salt: string) => createHmac('sha256', salt).update(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').digest()
export function signToken<T extends object>(salt: string, t: T): string {
  const b = Buffer.from(JSON.stringify(t)).toString('base64url')
  return b + '.' + createHmac('sha256', secret(salt)).update(b).digest('base64url')
}
export function verifyToken<T>(salt: string, token: string): T | null {
  const [b, s] = token.split('.')
  if (!b || !s) return null
  const want = createHmac('sha256', secret(salt)).update(b).digest()
  const got = Buffer.from(s, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()) as T } catch { return null }
}

/** AI 이미지 생성 token (u=요청자, rid=Modal 호출 id, ref=프롬코인 차감 ref) */
export interface ImageTok { u: string; rid: string; ref: string; cost: number; prompt: string; at: number }
