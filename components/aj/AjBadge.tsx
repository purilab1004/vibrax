// AJ 이름 — 게임마다 태어나는 AJ: "AJ-Brick" 처럼 게임 제목에서 짧은 태그를 만든다
export function ajNameOf(title: string): string {
  const t = title.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)[0] ?? ''
  const short = t.length > 8 ? t.slice(0, 8) : t
  return `AJ-${short || 'Game'}`
}
