// lib/studio/attach.ts — 채팅 메시지에 첨부(이미지 썸네일·사운드 이름)를 함께 저장하는 마커. studio_messages.content 끝에 붙고,
// 화면에서는 파싱해 썸네일/칩으로 보여주며, 모델에 보내는 대화 이력에서는 떼어낸다. (클라이언트·서버 공용, sharp 의존 없음)
export interface Attach { images: string[]; sounds: string[] }
const MARK = '\n[[ATTACH:'
const RE = /\n\[\[ATTACH:(\{[\s\S]*?\})\]\]\s*$/

export function encodeAttach(a: Attach): string {
  if (!a.images.length && !a.sounds.length) return ''
  return `${MARK}${JSON.stringify({ images: a.images.slice(0, 3), sounds: a.sounds.slice(0, 2) })}]]`
}
export function parseAttach(content: string): { text: string; images: string[]; sounds: string[] } {
  const m = content.match(RE)
  if (!m) return { text: content, images: [], sounds: [] }
  try {
    const j = JSON.parse(m[1]) as Partial<Attach>
    return { text: content.slice(0, m.index).replace(/\s+$/, ''), images: Array.isArray(j.images) ? j.images.filter(s => typeof s === 'string' && s.startsWith('data:image/')) : [], sounds: Array.isArray(j.sounds) ? j.sounds.filter(s => typeof s === 'string').map(s => s.slice(0, 60)) : [] }
  } catch { return { text: content.replace(RE, ''), images: [], sounds: [] } }
}
export const stripAttach = (content: string) => parseAttach(content).text
