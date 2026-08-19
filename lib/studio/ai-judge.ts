// AI 자동 판단 — 프롬프트가 어느 템플릿(장르)인지 Haiku 에게 분류만 시킨다 (출력 ~30토큰, 생성 대비 1/1000 비용)
import Anthropic from '@anthropic-ai/sdk'
import { logUsage } from '@/lib/llm/usage'

export async function aiJudgeTemplate(prompt: string, templates: { slug: string; name: string; keywords: string[] }[], userId: string, projectId: string): Promise<{ slug: string | null; keyword: string | null; confidence: number }> {
  if (!process.env.ANTHROPIC_API_KEY || templates.length === 0) return { slug: null, keyword: null, confidence: 0 }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = templates.map(t => `- ${t.slug}: ${t.name} (${t.keywords.slice(0, 5).join(', ')})`).join('\n')
  const model = 'claude-haiku-4-5-20251001'
  try {
    const res = await client.messages.create({ model, max_tokens: 60, temperature: 0,
      system: '너는 게임 요청 분류기다. 사용자의 요청이 아래 템플릿 중 하나와 "같은 게임 장르/규칙"이면 그 slug 를, 어느 것과도 다르면 none 을 고른다. 살짝 다른 테마·색·난이도 요구는 같은 템플릿으로 본다(예: 우주 배경 벽돌깨기 → breakout). 완전히 다른 장르면 none. 반드시 JSON 한 줄만: {"slug":"...","keyword":"요청에서 장르를 뜻하는 핵심 표현 1개","confidence":0~1}',
      messages: [{ role: 'user', content: `템플릿:\n${list}\n\n요청: ${prompt.slice(0, 500)}` }] })
    const text = res.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
    void logUsage({ userId, projectId, kind: 'classify', model, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, credits: 0 })
    const m = text.match(/\{[\s\S]*\}/); if (!m) return { slug: null, keyword: null, confidence: 0 }
    const j = JSON.parse(m[0]) as { slug?: string; keyword?: string; confidence?: number }
    const slug = j.slug && j.slug !== 'none' && templates.some(t => t.slug === j.slug) ? j.slug : null
    return { slug, keyword: j.keyword?.trim() || null, confidence: Number(j.confidence ?? 0) }
  } catch { return { slug: null, keyword: null, confidence: 0 } }
}
