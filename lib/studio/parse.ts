// 생성 스트림 텍스트 파싱. 모델 출력 형식: "짧은 설명\n<game>완결된 HTML</game>"
// 클라이언트는 누적 텍스트를 매 청크마다 통째로 다시 파싱한다(상태 없는 파서).

export const GEN_ERROR_MARKER = '\n[[GEN_ERROR]]'

export interface ParsedGeneration {
  description: string
  html: string | null
  htmlBytes: number
  generating: boolean
}

export function parseGeneration(text: string): ParsedGeneration {
  const clean = text.split(GEN_ERROR_MARKER).join('')
  const open = clean.indexOf('<game>')
  if (open === -1) {
    return { description: clean.trim(), html: null, htmlBytes: 0, generating: false }
  }
  const description = clean.slice(0, open).trim()
  const rest = clean.slice(open + '<game>'.length)
  const close = rest.indexOf('</game>')
  if (close === -1) {
    return { description, html: null, htmlBytes: rest.length, generating: true }
  }
  return { description, html: rest.slice(0, close).trim(), htmlBytes: close, generating: false }
}

export function hasGenError(text: string): boolean {
  return text.includes(GEN_ERROR_MARKER)
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title>([^<]{1,60})<\/title>/i)
  return m ? m[1].trim() : null
}
