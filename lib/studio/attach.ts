// lib/studio/attach.ts — 채팅 메시지에 첨부(이미지 썸네일·사운드 이름)를 함께 저장하는 마커. studio_messages.content 끝에 붙고,
// 화면에서는 파싱해 썸네일/칩으로 보여주며, 모델에 보내는 대화 이력에서는 떼어낸다. (클라이언트·서버 공용, sharp 의존 없음)
export interface AttachAsset { name: string; kind: string; url?: string }
export interface Attach { images: string[]; sounds: string[]; assets?: AttachAsset[] }
const MARK = '\n[[ATTACH:'
const RE = /\n\[\[ATTACH:(\{[\s\S]*?\})\]\]\s*$/

export function encodeAttach(a: Attach): string {
  const assets = (a.assets ?? []).slice(0, 10)
  if (!a.images.length && !a.sounds.length && !assets.length) return ''
  return `${MARK}${JSON.stringify({ images: a.images.slice(0, 3), sounds: a.sounds.slice(0, 2), assets })}]]`
}
export function parseAttach(content: string): { text: string; images: string[]; sounds: string[]; assets: AttachAsset[] } {
  const m = content.match(RE)
  if (!m) return { text: content, images: [], sounds: [], assets: [] }
  try {
    const j = JSON.parse(m[1]) as Partial<Attach>
    const assets = Array.isArray(j.assets) ? j.assets.filter(x => x && typeof x.name === 'string').map(x => ({ name: String(x.name).slice(0, 60), kind: String(x.kind ?? 'other'), url: typeof x.url === 'string' && /^https?:\/\//.test(x.url) ? x.url : undefined })) : []
    return { text: content.slice(0, m.index).replace(/\s+$/, ''), images: Array.isArray(j.images) ? j.images.filter(s => typeof s === 'string' && s.startsWith('data:image/')) : [], sounds: Array.isArray(j.sounds) ? j.sounds.filter(s => typeof s === 'string').map(s => s.slice(0, 60)) : [], assets }
  } catch { return { text: content.replace(RE, ''), images: [], sounds: [], assets: [] } }
}
export const stripAttach = (content: string) => parseAttach(content).text
