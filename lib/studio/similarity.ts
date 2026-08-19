// MLPilot v1 — 학습 모델 없이 동작하는 프롬프트↔템플릿 유사도 매퍼 (문자 2-gram + 토큰 코사인).
// 나중에 ML 모델(임베딩/분류기)로 교체하는 슬롯: rankTemplates() 의 시그니처를 유지한다.
export interface Doc { slug: string; text: string }
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
function grams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const t = norm(s)
  for (const w of t.split(' ')) { if (w.length >= 2) m.set('w:' + w, (m.get('w:' + w) ?? 0) + 2) }
  const c = t.replace(/\s/g, '')
  for (let i = 0; i < c.length - 1; i++) { const g = 'c:' + c.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1) }
  return m
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w }
  for (const v of b.values()) nb += v * v
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}
/** 프롬프트와 각 템플릿 문서(이름+키워드+원 프롬프트+설명)의 유사도 순위 */
export function rankTemplates(prompt: string, docs: Doc[]): { slug: string; score: number }[] {
  const p = grams(prompt)
  return docs.map(d => ({ slug: d.slug, score: cosine(p, grams(d.text)) })).sort((a, b) => b.score - a.score)
}
