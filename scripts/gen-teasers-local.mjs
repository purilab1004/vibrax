// 기존 게임 유혹 질문을 생성해 lib/teasers-local.json에 저장 (teaser 컬럼 생기기 전 임시 소스)
// 실행: node scripts/gen-teasers-local.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const AI_KEY = env.ANTHROPIC_API_KEY

const OUT = 'lib/teasers-local.json'
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

async function generate(title, description, genre) {
  const prompt = [
    "아케이드 게임 카드 앞면에 넣을 '유혹 질문' 한 줄을 만들어줘.",
    `게임 제목: ${title}`,
    genre ? `장르: ${genre}` : null,
    description ? `설명: ${description}` : null,
    '',
    '규칙:',
    '- 한국어, 5~12자, 물음표로 끝난다',
    '- 아주 짧고 강렬하게 — 한 호흡에 읽히는 도발',
    '- 게임 제목 단어를 그대로 쓰지 않는다',
    '- 이모지 금지, 따옴표 금지',
    '- 예시 톤: "멈추면 죽는다?" / "10초 버틸 수 있어?" / "네가 왕이 될 차례?" / "피할 수 있겠어?"',
    '- 출력은 질문 한 줄만',
  ].filter(Boolean).join('\n')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}`)
  const data = await res.json()
  const text = data.content?.find(c => c.type === 'text')?.text?.trim()
  return text ? text.replace(/^["'「]|["'」]$/g, '').split('\n')[0].slice(0, 40) : null
}

const res = await fetch(`${SB_URL}/rest/v1/games?select=id,title,description,genre`, {
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
})
const games = await res.json()
console.log(`게임 ${games.length}개`)

for (const g of games) {
  if (existing[g.id]) { console.log(`= ${g.title}: 이미 있음`); continue }
  try {
    const teaser = await generate(g.title, g.description, g.genre)
    if (teaser) {
      existing[g.id] = teaser
      console.log(`✓ ${g.title} → ${teaser}`)
    }
  } catch (e) {
    console.log(`✗ ${g.title}: ${e.message}`)
  }
}
writeFileSync(OUT, JSON.stringify(existing, null, 2))
console.log(`saved → ${OUT}`)
