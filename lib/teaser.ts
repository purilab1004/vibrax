// 게임 제목/설명 기반 '유혹 질문' 생성 — 카드 앞면 플래시카드 문구
// 서버 전용 (ANTHROPIC_API_KEY 사용)

export async function generateTeaser({ title, description, genre }: {
  title: string
  description?: string | null
  genre?: string | null
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !title) return null

  const prompt = [
    "아케이드 게임 카드 앞면에 넣을 '유혹 질문' 한 줄을 만들어줘.",
    `게임 제목: ${title}`,
    genre ? `장르: ${genre}` : null,
    description ? `설명: ${description}` : null,
    '',
    '규칙:',
    '- 한국어, 8~18자, 물음표로 끝난다',
    '- 게임 제목 단어를 그대로 쓰지 않는다 (제목은 카드를 뒤집어야 공개되는 정답)',
    '- 게임의 내용/조작/목표를 암시하면서 플레이 욕구를 자극하는 도발적이고 호기심을 끄는 톤',
    '- 이모지 금지, 따옴표 금지',
    '- 출력은 질문 한 줄만',
  ].filter(v => v !== null).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { content?: { type: string; text?: string }[] }
    const text = data.content?.find(c => c.type === 'text')?.text?.trim()
    if (!text) return null
    return text.replace(/^["'「]|["'」]$/g, '').split('\n')[0].slice(0, 40)
  } catch {
    return null
  }
}
