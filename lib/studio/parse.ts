// 생성 스트림 텍스트 파싱. 모델 출력 형식: "짧은 설명\n<game>완결된 HTML</game>"
// 클라이언트는 누적 텍스트를 매 청크마다 통째로 다시 파싱한다(상태 없는 파서).

export const GEN_ERROR_MARKER = '\n[[GEN_ERROR]]'
// 게임과 무관한 요청 — 모델이 <offtopic/>을 출력하면 서버가 이 마커로 변환해 내려준다
export const OFF_TOPIC_MARKER = '\n[[OFF_TOPIC]]'
// 수정 요청에 대해 모델이 코드 변경 없이 설명·질문만 한 경우 (예: 필요한 에셋이 없음) — 실패가 아니라 답변으로 표시, 크레딧 환불
export const ANSWER_MARKER = '\n[[ANSWER_ONLY]]'
// 실행 테스트 결과 — 워커가 결과 끝에 붙인다(본문에는 보이지 않고, 저장되는 답변 끝에 한 줄로 들어간다)
const TEST_RE = /\n?\[\[VBX_TEST\]\]([\s\S]*?)\[\[\/VBX_TEST\]\]/
export function extractTestNote(text: string): string | null {
  const m = TEST_RE.exec(text)
  return m ? m[1].trim() : null
}
export function hasAnswerOnly(text: string): boolean { return text.includes(ANSWER_MARKER) }
// 서버 함수 시간이 다 됐지만 생성은 계속 진행 중 — 클라이언트는 완성될 때까지 기다린다
const PENDING_RE = /\[\[PENDING:([0-9a-f-]{36})\]\]/
export function pendingJobId(text: string): string | null { return PENDING_RE.exec(text)?.[1] ?? null }

export function hasOffTopic(text: string): boolean {
  return text.includes(OFF_TOPIC_MARKER) || text.includes('<offtopic')
}

export interface ParsedGeneration {
  description: string
  html: string | null
  htmlBytes: number
  generating: boolean
}

export function parseGeneration(text: string): ParsedGeneration {
  const clean = text.replace(/\n\[\[GEN_MSG\]\][\s\S]*?\[\[\/GEN_MSG\]\]/g, '').replace(/\n?\[\[VBX_TEST\]\][\s\S]*?\[\[\/VBX_TEST\]\]/g, '').replace(/\n?\[\[PENDING:[0-9a-f-]{36}\]\]/g, '').split(GEN_ERROR_MARKER).join('').split(OFF_TOPIC_MARKER).join('').split(ANSWER_MARKER).join('').replace(/<offtopic\/?>/g, '')
  const first = clean.indexOf('<game>')
  // 실행 테스트에서 고친 완성본이 뒤에 다시 올 수 있으므로 '마지막' 게임 블록을 쓴다
  const open = clean.lastIndexOf('<game>')
  if (open === -1) {
    return { description: clean.trim(), html: null, htmlBytes: 0, generating: false }
  }
  const description = clean.slice(0, first).trim()
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
