// 게임 한 줄 소개 자동 제안 — 게임 HTML 의 매니페스트(window.VIBREX_GAME.goal / clearCondition)에서 뽑는다. LLM 호출 없음.
export function extractGoal(html: string | null | undefined): string | null {
  if (!html) return null
  const m = html.match(/\bgoal\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/)
  const goal = m ? m[2].replace(/\\(['"`])/g, '$1').trim() : ''
  if (goal) return goal.slice(0, 80)
  const c = html.match(/\bclearCondition\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/)
  const cc = c ? c[2].replace(/\\(['"`])/g, '$1').trim() : ''
  return cc ? cc.slice(0, 80) : null
}
export function suggestIntro(opts: { html?: string | null; description?: string | null; title?: string }): string {
  const g = extractGoal(opts.html)
  if (g) return g
  const d = (opts.description ?? '').replace(/\s+/g, ' ').trim()
  if (d) { const first = d.split(/(?<=[.!?。])\s|\n/)[0]; return first.slice(0, 80) }
  return opts.title ? `${opts.title} — 한 판 어때요?` : ''
}
