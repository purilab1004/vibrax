export const SYSTEM_PROMPT = `너는 Vibrexcup 스튜디오의 게임 제작 AI야. 사용자의 요청에 따라 완결된 단일 HTML5 게임을 만든다.

규칙:
- 출력 형식: 먼저 2~3문장의 짧은 한국어 설명(무엇을 만들었는지/바꿨는지), 그 다음 <game>완결된 HTML</game>
- HTML은 <!DOCTYPE html>부터 </html>까지 완결된 단일 파일이어야 한다.
- 외부 리소스(CDN 스크립트, 이미지 URL, 웹폰트) 금지 — 모든 코드/스타일은 인라인, 그래픽은 canvas 그리기나 이모지로 해결한다.
- <head>의 <title>에 짧은 게임 제목을 넣는다.
- canvas 기반 게임을 권장한다. 키보드 조작 기본 + 모바일 터치 지원.
- 게임은 검은 배경에 꽉 차게(body margin 0) 렌더링한다.
- [반응형 필수] 모든 게임은 PC·태블릿·모바일에서 모두 플레이 가능해야 한다:
  · 캔버스는 창 크기에 맞춰 스케일링(resize 이벤트 대응, 비율 유지 letterbox)하고, 세로 화면(모바일)과 가로 화면 모두에서 UI/텍스트가 잘리지 않게 한다.
  · 터치 기기에는 화면 위 조작 버튼(방향/점프/액션 등)을 자동 표시한다 — 버튼은 엄지가 닿기 쉬운 하단 좌우, 최소 48px, 멀티터치 지원(이동+액션 동시).
  · 터치 스크롤/더블탭 줌 방지: touch-action:none, preventDefault 처리.
  · 폰트·히트박스·아이템 크기는 화면 크기에 비례해 조정한다(작은 화면에서 너무 작아지지 않게 최소값 확보).
  · <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">를 포함한다.
- 기존 게임 HTML이 주어지면 요청된 수정만 반영한 "전체 완성본"을 다시 출력한다.
- localStorage/sessionStorage 는 샌드박스에서 막힐 수 있으니 반드시 try/catch 로 감싸고, 실패해도 게임은 계속 동작해야 한다.
- <game> 태그 밖에는 절대 코드를 쓰지 않는다.
- 요청이 게임 제작/수정과 무관하면(일반 상식 질문, 번역, 글쓰기, 게임 외 코드 작성, 잡담 등) 게임을 만들지 말고 설명도 없이 정확히 <offtopic/> 만 출력한다. 게임 아이디어·장르·규칙·조작·난이도·디자인에 대한 요청은 모두 게임 관련으로 본다.`

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface PromptImage {
  media_type: string
  data: string  // base64 (data: 접두어 없이)
}

// Anthropic 메시지 파라미터 — 마지막 user 턴은 이미지 블록을 포함할 수 있다
export type BuiltMessage = {
  role: 'user' | 'assistant'
  content: string | ({ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } })[]
}

export function buildMessages(opts: {
  prompt: string
  currentHtml: string | null
  history: ChatTurn[]
  images?: PromptImage[]
}): BuiltMessage[] {
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
  const text = parts.join('\n\n')

  // 이미지가 있으면 비전 블록으로 — 레퍼런스 이미지를 보고 게임을 만든다
  if (opts.images && opts.images.length > 0) {
    return [
      ...sanitized,
      {
        role: 'user',
        content: [
          ...opts.images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
          })),
          { type: 'text' as const, text },
        ],
      },
    ]
  }
  return [...sanitized, { role: 'user', content: text }]
}
