// scripts/story-repair-state.ts — 연재는 있는데 story_state 가 빠진 게임의 진행 상태를 복구한다(지금 게임 코드 기준으로 '나온 요소' 채움).
// 실행: node --import ./scripts/ts-resolve.mjs scripts/story-repair-state.ts
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { loadStoryGame, loadGameHtml, loadState, saveGameState, listEpisodes } from '../lib/story/server'
import { detectPrompt, digestGame, parseJson, mergeCovered, type DetectResult } from '../lib/story/core'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const cliEnv = (() => { const e: NodeJS.ProcessEnv = { ...process.env, CLAUDECODE: '' }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e })()
const claude = (prompt: string) => new Promise<string>((res, rej) => {
  const p = spawn('claude', ['-p', '--tools', '', '--no-session-persistence', '--effort', 'medium', '--model', 'sonnet', '--output-format', 'text', '--system-prompt', '너는 한국 웹소설 작가이자 게임 분석가다. 요청한 JSON 만 출력한다.'], { env: cliEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  let out = ''; p.stdout.on('data', d => { out += d }); p.on('close', c => (c === 0 ? res(out) : rej(new Error(`claude ${c}`)))); p.stdin.end(prompt)
})

const { data } = await sb.from('games').select('id,title')
const state = await loadState(sb)
for (const g of (data ?? []) as { id: string; title: string }[]) {
  if (state[g.id] || !(await listEpisodes(sb, g.id)).length) continue
  const game = (await loadStoryGame(sb, g.id))!
  const { html, versionId } = await loadGameHtml(sb, game)
  const det = parseJson<DetectResult>(await claude(detectPrompt(game, digestGame(html), [])))
  const covered = mergeCovered([], det?.elements ?? [])
  await saveGameState(sb, g.id, { version: versionId, covered, checkedAt: new Date().toISOString(), pending: [] })
  console.log('복구', g.title, covered.join(', '))
}
