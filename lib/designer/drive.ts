// 디자이너 드라이브 — 스토리지(media 버킷) drive/<uid>/[폴더/]파일 에 그대로 저장하는 구글 드라이브 형태의 개인 보관함.
// 스토리지 키는 ASCII 만 받으므로 폴더·파일 이름은 base64url 로 감싼다. GLB 의 썸네일은 같은 키 + '.t' 로 옆에 둔다.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const BUCKET = 'media'
export const enc = (name: string) => Buffer.from(name, 'utf8').toString('base64url')
export const dec = (seg: string) => { try { return Buffer.from(seg.split('.')[0], 'base64url').toString('utf8') } catch { return seg } }
export const root = (uid: string) => `drive/${uid}`
export const folderPath = (uid: string, folder: string) => (folder ? `${root(uid)}/${enc(folder)}` : root(uid))
export const cleanName = (s: string, max = 80) => s.replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
export const extOf = (name: string) => (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? '').toLowerCase()
export function mimeOf(name: string): string {
  const e = extOf(name)
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', glb: 'model/gltf-binary', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' } as Record<string, string>)[e] ?? 'application/octet-stream'
}
export const DRIVE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'glb', 'mp3', 'wav', 'ogg', 'm4a']

/** 디자이너(승인)·관리자만 — 아니면 응답을 돌려준다 */
export async function requireDesigner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: '로그인이 필요해요' }, { status: 401 }) }
  const admin = createAdminClient()
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (prof as { role?: string } | null)?.role ?? 'user'
  if (role !== 'designer' && role !== 'admin') return { error: Response.json({ error: '디자이너로 승인된 회원만 쓸 수 있어요' }, { status: 403 }) }
  return { user, role, admin, supabase }
}

/** 같은 이름이 있으면 '이름 (2).ext' 처럼 비켜 간다 */
export async function freeKey(admin: ReturnType<typeof createAdminClient>, dir: string, name: string): Promise<{ key: string; name: string }> {
  const { data } = await admin.storage.from(BUCKET).list(dir, { limit: 1000 })
  const taken = new Set((data ?? []).map((f) => f.name))
  const m = name.match(/^(.*?)(\.[a-z0-9]{2,5})?$/i)!
  for (let i = 1; i < 200; i++) {
    const n = i === 1 ? name : `${m[1]} (${i})${m[2] ?? ''}`
    if (!taken.has(enc(n))) return { key: `${dir}/${enc(n)}`, name: n }
  }
  const n = `${m[1]} ${Date.now()}${m[2] ?? ''}`
  return { key: `${dir}/${enc(n)}`, name: n }
}
