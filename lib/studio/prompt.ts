export const SYSTEM_PROMPT = `너는 Vibrexcup 스튜디오의 게임 제작 AI야. 사용자의 요청에 따라 완결된 단일 HTML5 게임을 만든다.

규칙:
- 출력 형식: 먼저 2~3문장의 짧은 한국어 설명(무엇을 만들었는지/바꿨는지), 그 다음 <game>완결된 HTML</game>
- HTML은 <!DOCTYPE html>부터 </html>까지 완결된 단일 파일이어야 한다.
- 외부 리소스(CDN 스크립트, 이미지 URL, 웹폰트) 금지 — 모든 코드/스타일은 인라인, 그래픽은 canvas 그리기나 이모지로 해결한다.
- <head>의 <title>에 짧은 게임 제목을 넣는다.
- canvas 기반 게임을 권장한다. 키보드 조작 기본 + 모바일 터치 지원.
- 게임은 검은 배경에 꽉 차게(body margin 0) 렌더링한다.
- 기존 게임 HTML이 주어지면 요청된 수정만 반영한 "전체 완성본"을 다시 출력한다.
- <game> 태그 밖에는 절대 코드를 쓰지 않는다.
- 요청이 게임 제작/수정과 무관하면(일반 상식 질문, 번역, 글쓰기, 게임 외 코드 작성, 잡담 등) 게임을 만들지 말고 설명도 없이 정확히 <offtopic/> 만 출력한다. 게임 아이디어·장르·규칙·조작·난이도·디자인에 대한 요청은 모두 게임 관련으로 본다.`

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export function buildMessages(opts: {
  prompt: string
  currentHtml: string | null
  history: ChatTurn[]
}): ChatTurn[] {
  // 최근 6턴만, 역할 교대 강제 (기존 app/api/user-agent/chat 패턴)
  const sanitized: ChatTurn[] = []
  for (const m of opts.history.slice(-6)) {
    if (!m.content?.trim()) continue
    const last = sanitized[sanitized.length - 1]
    if (!last || last.role !== m.role) sanitized.push({ role: m.role, content: m.content })
    else sanitized[sanitized.length - 1] = { role: m.role, content: m.content }
  }
  while (sanitized.length > 0 && sanitized[0].role === 'assistant') sanitized.shift()
  // 새 user 메시지가 뒤에 붙으므로 history 끝의 user는 제거해 교대를 유지
  if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') sanitized.pop()

  const parts: string[] = []
  if (opts.currentHtml) parts.push(`현재 게임 HTML:\n<game>${opts.currentHtml}</game>`)
  parts.push(`요청: ${opts.prompt}`)
  return [...sanitized, { role: 'user', content: parts.join('\n\n') }]
}
