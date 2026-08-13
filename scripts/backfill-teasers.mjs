// 기존 게임들의 유혹 질문(teaser) 백필 — teaser가 null인 게임마다 AI로 생성해 저장
// 실행: node scripts/backfill-teasers.mjs  (.env.local의 키 사용, 멱등)
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const AI_KEY = env.ANTHROPIC_API_KEY
if (!SB_URL || !SB_KEY || !AI_KEY) { console.error('missing env'); process.exit(1) }

const sb = (path, init = {}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...init.headers },
})

async function generate(title, description, genre) {
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

const listRes = await sb('games?select=id,title,description,genre&teaser=is.null')
if (!listRes.ok) { console.error('list failed:', await listRes.text()); process.exit(1) }
const games = await listRes.json()
console.log(`teaser 없는 게임: ${games.length}개`)

for (const g of games) {
  try {
    const teaser = await generate(g.title, g.description, g.genre)
    if (!teaser) { console.log(`- ${g.title}: 생성 실패, 건너뜀`); continue }
    const up = await sb(`games?id=eq.${g.id}`, { method: 'PATCH', body: JSON.stringify({ teaser }) })
    console.log(up.ok ? `✓ ${g.title} → ${teaser}` : `✗ ${g.title}: ${await up.text()}`)
  } catch (e) {
    console.log(`✗ ${g.title}: ${e.message}`)
  }
}
console.log('done')
