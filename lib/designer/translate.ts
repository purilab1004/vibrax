// 한국어 설명 → 이미지·3D 모델용 영어 한 줄 (Claude Haiku). 실패하면 원문 그대로 — 서버 전용
import Anthropic from '@anthropic-ai/sdk'

// 한국어 → 이미지 모델용 영어 한 줄 (실패하면 원문 그대로)
export async function toEnglish(prompt: string): Promise<string> {
  if (!/[가-힣]/.test(prompt) || !process.env.ANTHROPIC_API_KEY) return prompt
  try {
    const r = await new Anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      system: 'Translate the user\'s image description into one concise English prompt for a text-to-image model. Keep every visual detail. Output only the prompt.',
      messages: [{ role: 'user', content: prompt }],
    })
    const t = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim()
    return t || prompt
  } catch { return prompt }
}
