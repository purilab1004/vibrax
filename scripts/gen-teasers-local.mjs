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

const STYLES = ['도발하는 질문', '짧은 명령형 한마디', '강렬한 선언 한마디', '도전장을 던지는 한마디']

async function generate(title, description, genre, style) {
  const prompt = [
    '아케이드 게임 카드 앞면에 넣을, 당장 플레이하고 싶게 만드는 훅 문구 한 줄을 만들어줘.',
    `게임 제목: ${title}`,
    genre ? `장르: ${genre}` : null,
    description ? `설명: ${description}` : null,
    '',
    '규칙:',
    `- 형식: ${style}`,
    '- 한국어, 5~12자 — 한 호흡에 읽히게 아주 짧고 강렬하게',
    '- 게임 제목 단어를 그대로 쓰지 않는다',
    '- 이모지 금지, 따옴표 금지',
    '- 예시 톤: "멈추면 죽는다" / "왕좌를 뺏어라" / "10초 생존 도전" / "피할 수 있겠어?"',
    '- 출력은 한 줄만',
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

let idx = 0
for (const g of games) {
  if (existing[g.id]) { console.log(`= ${g.title}: 이미 있음`); continue }
  try {
    const teaser = await generate(g.title, g.description, g.genre, STYLES[idx++ % STYLES.length])
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
