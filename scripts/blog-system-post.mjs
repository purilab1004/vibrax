// 시스템 업데이트 블로그 글 자동 생성 — 오늘의 git 커밋을 요약해 게시.
// 하루 1회만: 오늘 자 source='system' 글이 이미 있으면 스킵 (멱등).
// 실행: node scripts/blog-system-post.mjs
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const AI_KEY = env.ANTHROPIC_API_KEY

const sb = (path, init = {}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', Prefer: 'return=representation', ...init.headers },
})

// 1) 오늘 자 system 글이 이미 있으면 스킵
const today = new Date()
const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
const existRes = await sb(`blog_posts?select=id&source=eq.system&published_at=gte.${dayStart}&limit=1`)
const exist = await existRes.json()
if (Array.isArray(exist) && exist.length > 0) {
  console.log('오늘 자 시스템 업데이트 글이 이미 있음 — 스킵')
  process.exit(0)
}

// 2) 오늘의 커밋 수집
const log = execSync('git log --since=midnight --pretty=%s --no-merges', { encoding: 'utf8' }).trim()
if (!log) { console.log('오늘 커밋 없음 — 스킵'); process.exit(0) }
const commits = log.split('\n').filter(Boolean)
console.log(`오늘 커밋 ${commits.length}건`)

// 3) 관리자 작성자
const authorRes = await sb('profiles?select=id&role=eq.admin&limit=1')
const [author] = await authorRes.json()
if (!author) { console.error('관리자 계정 없음'); process.exit(1) }

// 4) 글 생성
const prompt = [
  'Vibrexcup(AI 게임 제작·공유 플랫폼) 사이트가 오늘 업데이트됐어. 사용자에게 알리는 블로그 글을 한국어로 써줘.',
  '',
  '오늘의 변경 사항 (git 커밋 메시지):',
  ...commits.map(c => `- ${c}`),
  '',
  '규칙:',
  '- 사용자 관점에서 무엇이 바뀌었는지 / 왜 바꿨는지 / 무엇이 좋아졌는지를 묶어서 자세히 설명',
  '- 개발 용어(커밋, 컴포넌트명, CSS 등)는 쓰지 말고 사용자가 체감할 변화 중심으로',
  '- 사소한 내부 수정은 묶거나 생략하고 굵직한 개선 위주로 3~6개 섹션',
  '- 톤: 친근하고 설레는 제품 업데이트 노트',
  '- 분량 600~1200자',
  '- 출력은 JSON 한 줄만: {"title":"글 제목 (날짜 포함 금지, 핵심 개선 중심)","excerpt":"한 줄 요약 (80자 이내)","html":"<h2>섹션</h2><p>..</p> 형태 본문 HTML (h2/p/strong/ul/li만)"}',
].join('\n')

const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
})
if (!aiRes.ok) { console.error('생성 실패', aiRes.status, await aiRes.text()); process.exit(1) }
const aiData = await aiRes.json()
const text = aiData.content?.find(c => c.type === 'text')?.text?.trim() ?? ''
const m = text.match(/\{[\s\S]*\}/)
if (!m) { console.error('파싱 실패'); process.exit(1) }
const post = JSON.parse(m[0])
if (!post.title || !post.html) { console.error('불완전한 응답'); process.exit(1) }

// 5) 게시
const ins = await sb('blog_posts', {
  method: 'POST',
  body: JSON.stringify([{
    title: post.title.slice(0, 120),
    content: post.html,
    excerpt: (post.excerpt ?? '').slice(0, 160),
    published: true,
    published_at: new Date().toISOString(),
    author_id: author.id,
    thumbnail_url: null,
    source: 'system',
  }]),
})
if (!ins.ok) { console.error('게시 실패:', await ins.text()); process.exit(1) }
const [row] = await ins.json()
console.log(`✓ 게시 완료: ${post.title}`)
console.log(`  https://vibrexcup.com/blog/${row.id}`)
