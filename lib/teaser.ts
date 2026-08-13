// 게임 제목/설명 기반 카드 훅 문구 생성 (한/영 동시) — 서버 전용 (ANTHROPIC_API_KEY 사용)

const STYLES = ['도발하는 질문', '짧은 명령형 한마디', '강렬한 선언 한마디', '도전장을 던지는 한마디'] as const

export interface TeaserPair {
  ko: string | null
  en: string | null
}

export async function generateTeaser({ title, description, genre }: {
  title: string
  description?: string | null
  genre?: string | null
}): Promise<TeaserPair> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !title) return { ko: null, en: null }

  let th = 0
  for (let i = 0; i < title.length; i++) th = (th * 31 + title.charCodeAt(i)) | 0
  const style = STYLES[Math.abs(th) % STYLES.length]

  const prompt = [
    '아케이드 게임 카드 앞면에 넣을, 당장 플레이하고 싶게 만드는 훅 문구를 만들어줘.',
    `게임 제목: ${title}`,
    genre ? `장르: ${genre}` : null,
    description ? `설명: ${description}` : null,
    '',
    '규칙:',
    `- 형식: ${style}`,
    '- 한국어 5~12자 — 한 호흡에 읽히게 아주 짧고 강렬하게',
    '- 영어 버전도 같은 뉘앙스로 (3~7단어)',
    '- 게임 제목 단어를 그대로 쓰지 않는다',
    '- 이모지 금지, 따옴표 금지',
    '- 예시 톤: "멈추면 죽는다" / "왕좌를 뺏어라" / "10초 생존 도전" / "피할 수 있겠어?"',
    '- 출력은 JSON 한 줄만: {"ko":"...","en":"..."}',
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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return { ko: null, en: null }
    const data = await res.json() as { content?: { type: string; text?: string }[] }
    const text = data.content?.find(c => c.type === 'text')?.text?.trim()
    if (!text) return { ko: null, en: null }
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return { ko: null, en: null }
    const parsed = JSON.parse(m[0]) as { ko?: string; en?: string }
    return {
      ko: parsed.ko?.trim().slice(0, 40) || null,
      en: parsed.en?.trim().slice(0, 60) || null,
    }
  } catch {
    return { ko: null, en: null }
  }
}
