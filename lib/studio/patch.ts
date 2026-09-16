// lib/studio/patch.ts — 수정 요청에 대한 "부분 패치" 형식. 모델이 전체 HTML(수만 자)을 다시 쓰지 않고
// <patch> 블록(SEARCH/REPLACE)만 내면 서버가 기존 HTML 에 적용한다 → 출력 토큰·시간이 수십 배 줄어든다.
//   <patch>
//   <<<<<<< SEARCH
//   (기존 HTML 의 원문 발췌 — 정확히 한 곳에만 있는 3~30줄)
//   =======
//   (교체 내용)
//   >>>>>>> REPLACE
//   </patch>
export interface PatchBlock { search: string; replace: string }
export interface ExtractedPatches { blocks: PatchBlock[]; description: string; hasPatch: boolean }

const BLOCK_RE = /<patch>\s*<{7}\s*SEARCH\s*\n([\s\S]*?)\n?={7}\s*\n([\s\S]*?)\n?>{7}\s*REPLACE\s*<\/patch>/g

export function extractPatches(text: string): ExtractedPatches {
  const blocks: PatchBlock[] = []
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  while ((m = BLOCK_RE.exec(text)) !== null) blocks.push({ search: m[1], replace: m[2] })
  const first = text.indexOf('<patch>')
  const description = (first >= 0 ? text.slice(0, first) : text).replace(/<\/?patches?>/g, '').trim()
  return { blocks, description, hasPatch: first >= 0 }
}

const normLines = (s: string) => s.split('\n').map(l => l.trim()).filter(l => l.length > 0)

/** 정확 일치 → 줄 단위 공백 무시 일치 순으로 찾아 교체. 실패한 블록 번호를 돌려준다 */
export function applyPatches(base: string, blocks: PatchBlock[]): { html: string; failed: number[] } {
  let html = base
  const failed: number[] = []
  blocks.forEach((b, i) => {
    const search = b.search.replace(/\r\n/g, '\n'), replace = b.replace.replace(/\r\n/g, '\n')
    if (!search.trim()) { failed.push(i); return }
    let idx = html.indexOf(search)
    if (idx >= 0) { html = html.slice(0, idx) + replace + html.slice(idx + search.length); return }
    // 공백/들여쓰기 차이 허용: 줄 단위로 trim 해 비교
    const want = normLines(search)
    if (!want.length) { failed.push(i); return }
    const lines = html.split('\n')
    for (let s = 0; s < lines.length; s++) {
      if (lines[s].trim() !== want[0]) continue
      let k = 0, e = s
      while (e < lines.length && k < want.length) {
        const t = lines[e].trim()
        if (t.length === 0) { e++; continue }
        if (t !== want[k]) break
        k++; e++
      }
      if (k === want.length) {
        idx = lines.slice(0, s).join('\n').length + (s > 0 ? 1 : 0)
        const end = lines.slice(0, e).join('\n').length
        html = html.slice(0, idx) + replace + html.slice(end)
        return
      }
    }
    failed.push(i)
  })
  return { html, failed }
}
