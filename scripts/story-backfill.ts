// scripts/story-backfill.ts — BLOG → STORY 전환용 1회 실행 스크립트(재실행 가능).
//  1) 공개된 게임마다 게임 화면을 헤드리스 크롬으로 찍어(3:4 세로) 웹툰 컷으로 올린다 — 메이플처럼 지도가 여러 개면 지도마다
//  2) (--wipe) 기존 blog 글을 전부 삭제
//  3) 게임마다 연재 계획 → 1화(도입부) + 지도 순서대로 다음 화들을 쓴다. 글은 claude -p(Max 구독)로 — API 크레딧을 쓰지 않는다
//  4) site_settings.story_state 에 게임별 진행 상태(나온 지도·몬스터, 기준 버전)를 저장 → 이후 업데이트 감지의 기준
// 실행: node --import ./scripts/ts-resolve.mjs scripts/story-backfill.ts [--wipe] [--only=<gameId앞자리>] [--no-shots] [--dry] [--resume]
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { makePlan, writeEpisode, loadStoryGame, loadGameHtml, saveGameState, listEpisodes, type Llm } from '../lib/story/server'
import { digestGame, mergeCovered, STORY_SOURCE, type StoryCut } from '../lib/story/core'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const args = process.argv.slice(2)
const WIPE = args.includes('--wipe'), DRY = args.includes('--dry'), NO_SHOTS = args.includes('--no-shots')
const ONLY = args.find(a => a.startsWith('--only='))?.slice(7)
const RESUME = args.includes('--resume')   // 중간에 끊긴 연재를 이어 쓴다(이미 쓴 화 다음부터)
const SHOT_DIR = process.env.STORY_SHOT_DIR || '/tmp/story-shots'
const BUCKET = 'blog-images'

// claude CLI 가 .env.local 의 ANTHROPIC_API_KEY 가 아니라 claude.ai(Max) 로그인으로 돌도록 키를 뺀 환경
const cliEnv = (() => { const e: NodeJS.ProcessEnv = { ...process.env, CLAUDECODE: '' }; delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; return e })()
const claudeLlm: Llm = (prompt) => new Promise((resolve, reject) => {
  const p = spawn('claude', ['-p', '--tools', '', '--no-session-persistence', '--effort', 'medium', '--model', 'sonnet', '--output-format', 'text', '--system-prompt', '너는 한국 웹소설 작가이자 게임 분석가다. 요청한 JSON 만 출력한다.'], { env: cliEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { err += d })
  p.on('close', code => (code === 0 ? resolve(out) : reject(new Error(`claude -p ${code}: ${err.slice(0, 300)}`))))
  p.stdin.end(prompt)
})

type G = { id: string; title: string; studio_project_id: string | null }

// ── 1) 스크린샷 ──────────────────────────────────────────────────────────────
async function capture(games: G[]): Promise<Record<string, { title?: string; play?: string[]; maps?: { name: string; file: string }[] }>> {
  const { chromium } = await import('/Users/sungjunahn/gstack/node_modules/playwright/index.mjs' as string) as typeof import('playwright')
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--headless=new', '--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const out: Awaited<ReturnType<typeof capture>> = {}
  for (const g of games) {
    if (!g.studio_project_id) continue
    // 세로(3:4)로 열어 보고, 게임 화면(가장 큰 canvas)이 가로형이면 가로(16:9)로 다시 연다 — 레터박스 없는 컷
    let ctx = await browser.newContext({ viewport: { width: 540, height: 720 }, deviceScaleFactor: 1.5 })
    let page = await ctx.newPage()
    const url = `https://vibrexcup.com/play/${g.studio_project_id}`
    const r: (typeof out)[string] = { play: [] }
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(2500)
      const wide = await page.evaluate(`(() => { const c = [...document.querySelectorAll('canvas')].map(c => c.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return !!c && c.width > c.height * 1.15 })()`).catch(() => false)
      if (wide) {
        await ctx.close()
        ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1.25 })
        page = await ctx.newPage()
        await page.goto(url, { waitUntil: 'load', timeout: 30000 })
      }
      await page.waitForTimeout(3000)
      const f0 = `${SHOT_DIR}/${g.id}-title.jpg`
      await page.screenshot({ path: f0, type: 'jpeg', quality: 82 }); r.title = f0
      // 시작 — '시작' 류 버튼, 없으면 화면 가운데 탭 + Space/Enter
      const vp = page.viewportSize()!
      for (let k = 0; k < 2; k++) {
        const btn = page.getByRole('button', { name: /시작|start|play|플레이|모험|게임/i }).first()
        if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 1500 }).catch(() => {})
        else { await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {}); await page.keyboard.press('Space').catch(() => {}); await page.keyboard.press('Enter').catch(() => {}) }
        await page.waitForTimeout(900)
      }
      // 조작 조금(오른쪽 이동·점프) 하며 장면 두 장
      for (const [i, wait] of [[1, 2500], [2, 5000]] as const) {
        await page.keyboard.down('ArrowRight').catch(() => {}); await page.waitForTimeout(wait / 2); await page.keyboard.up('ArrowRight').catch(() => {})
        await page.keyboard.press('ArrowUp').catch(() => {}); await page.waitForTimeout(wait / 2)
        const f = `${SHOT_DIR}/${g.id}-play${i}.jpg`
        await page.screenshot({ path: f, type: 'jpeg', quality: 82 }); r.play!.push(f)
      }
      // 지도가 여러 개인 게임(MAPS + loadMap) — 지도마다 한 장
      // const/function 선언은 window 속성이 아닐 수 있어 전역 스코프에서 이름으로 확인
      const maps = await page.evaluate(`(() => { try { return (typeof loadMap === 'function' && Array.isArray(MAPS)) ? MAPS.map(m => m.name) : null } catch (e) { return null } })()`).catch(() => null) as string[] | null
      if (maps?.length) {
        r.maps = []
        for (let i = 0; i < maps.length; i++) {
          await page.evaluate(`(() => { try { if (typeof player !== 'undefined') player.inv = 1e9 } catch (e) {} loadMap(${i}, 0) })()`).catch(() => {})
          await page.waitForTimeout(600)
          // 그 지도의 가장 센 몬스터 앞으로 주인공을 옮겨 몬스터가 컷에 들어오게
          await page.evaluate(`(() => { try { if (typeof monsters !== 'undefined' && monsters.length && typeof player !== 'undefined') { const m = monsters.slice().sort((a, b) => (b.maxHp || b.hp || 0) - (a.maxHp || a.hp || 0))[0]; player.x = Math.max(60, m.x - 300); player.facing = 1; player.inv = 1e9 } } catch (e) {} })()`).catch(() => {})
          await page.waitForTimeout(1600)
          const f = `${SHOT_DIR}/${g.id}-map${i}.jpg`
          await page.screenshot({ path: f, type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: vp.width, height: Math.round(vp.height * 0.86) } }); r.maps.push({ name: maps[i], file: f })
        }
      }
      console.log('📸', g.title, r.maps ? `지도 ${r.maps.length}장` : '')
    } catch (e) { console.warn('📸 실패', g.title, (e as Error).message) }
    out[g.id] = r
    await ctx.close()
  }
  await browser.close()
  return out
}

async function upload(file: string, gameId: string): Promise<string | null> {
  const path = `story/${gameId}/${file.split('/').pop()}`
  const { error } = await sb.storage.from(BUCKET).upload(path, fs.readFileSync(file), { contentType: 'image/jpeg', upsert: true })
  if (error) { console.warn('업로드 실패', path, error.message); return null }
  return `${sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now().toString(36)}`
}

// ── 3) 연재 쓰기 ──────────────────────────────────────────────────────────────
async function writeSeries(g: G, shots: Awaited<ReturnType<typeof capture>>[string] | undefined, authorId: string) {
  const game = await loadStoryGame(sb, g.id)
  if (!game) return
  const existing = await listEpisodes(sb, g.id)
  if (existing.length && !RESUME) { console.log('⏭ 이미 연재 중', g.title); return }
  const { html, versionId } = await loadGameHtml(sb, game)
  const multiMap = !!shots?.maps?.length
  const plan = await makePlan(claudeLlm, game, digestGame(html))
  // 지도가 여러 개인 게임만 여러 화 — 그 밖의 게임은 1화(도입부)로 시작, 이후 업데이트 때 다음 화
  let episodes = multiMap ? plan.episodes : plan.episodes.slice(0, 1)
  // 지도 순서는 게임 속 지도 목록(MAPS) 순서를 따른다 — 1화(도입부)는 그대로 맨 앞
  if (multiMap && episodes.length > 2) {
    const order = (e: typeof episodes[number]) => { const n = shots!.maps!.findIndex(m => e.focus.some(f => f.name.replace(/\s/g, '') === m.name.replace(/\s/g, ''))); return n < 0 ? 999 : n }
    episodes = [episodes[0], ...episodes.slice(1).sort((a, b) => order(a) - order(b))]
  }
  if (multiMap && !plan.episodes.some(e => e.focus.some(f => f.kind === 'map'))) console.warn('계획에 지도가 없음', g.title)

  const mapCut = async (names: string[]): Promise<StoryCut[]> => {
    const hit = shots?.maps?.find(m => names.some(n => m.name.replace(/\s/g, '') === n.replace(/\s/g, '')))
    const url = hit ? await upload(hit.file, g.id) : null
    return url ? [{ url, caption: hit!.name }] : []
  }
  let covered = mergeCovered([], plan.elements.filter(e => e.kind === 'character'))
  const prev: { no: number; title: string; excerpt: string }[] = [...existing]
  for (let i = 0; i < existing.length && i < episodes.length; i++) covered = mergeCovered(covered, episodes[i].focus)
  if (existing.length >= episodes.length) console.log('⏭ 계획한 화를 모두 씀', g.title)
  for (let i = existing.length; i < episodes.length; i++) {
    const ep = episodes[i]
    let cuts: StoryCut[] = []
    if (multiMap) cuts = await mapCut(ep.focus.filter(f => f.kind === 'map' || f.kind === 'stage').map(f => f.name))
    if (i === 0) {
      // 1화: 타이틀 화면을 첫 컷으로, 지도 게임은 그 뒤에 첫 지도, 그 밖의 게임은 플레이 장면
      const files = [shots?.title, ...(multiMap ? [] : (shots?.play ?? []).slice(0, 1))].filter(Boolean) as string[]
      const urls = (await Promise.all(files.map(f => upload(f, g.id)))).filter(Boolean) as string[]
      cuts = [...urls.map(url => ({ url, caption: g.title })), ...cuts]
    }
    if (DRY) { console.log(`  [dry] ${i + 1}화 focus=${ep.focus.map(f => f.name).join(',')} cuts=${cuts.length}`); continue }
    const written = await writeEpisode(sb, claudeLlm, { game, episodeNo: i + 1, focus: ep.focus, hint: ep.hint, hero: plan.hero, world: plan.world, prev, cuts, published: true, authorId })
    prev.push({ no: i + 1, title: written.title, excerpt: ep.hint })
    covered = mergeCovered(covered, ep.focus)
    console.log(`  ✍ ${g.title} ${i + 1}화 「${written.title}」`)
    // 화마다 상태 저장 — 중간에 끊겨도 --resume 으로 이어 쓰고, 업데이트 감지 기준이 남는다
    await saveGameState(sb, g.id, { version: versionId, covered, checkedAt: new Date().toISOString(), hero: plan.hero, world: plan.world, pending: [] })
  }
  if (!DRY) await saveGameState(sb, g.id, { version: versionId, covered, checkedAt: new Date().toISOString(), hero: plan.hero, world: plan.world, pending: [] })
}

async function main() {
  const { data } = await sb.from('games').select('id,title,studio_project_id').order('created_at', { ascending: true })
  const games = ((data ?? []) as G[]).filter(g => !ONLY || g.id.startsWith(ONLY))
  console.log(`게임 ${games.length}개`)
  // --no-shots: 지난번 찍어 둔 컷(shots.json)을 다시 쓴다
  const saved = `${SHOT_DIR}/shots.json`
  const shots = NO_SHOTS ? (fs.existsSync(saved) ? JSON.parse(fs.readFileSync(saved, 'utf8')) : {}) : await capture(games)
  if (!NO_SHOTS) fs.writeFileSync(saved, JSON.stringify(shots, null, 2))

  if (WIPE && !DRY) {
    const a = await sb.from('blog_posts').delete({ count: 'exact' }).is('source', null)
    const b = await sb.from('blog_posts').delete({ count: 'exact' }).neq('source', STORY_SOURCE)
    console.log('🗑 기존 blog 글 삭제', (a.count ?? 0) + (b.count ?? 0), a.error?.message ?? '', b.error?.message ?? '')
  }
  const { data: adm } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()
  const authorId = (adm as { id: string }).id

  const queue = [...games]
  // story_state 는 한 값(site_settings)이라 동시에 쓰면 서로 덮는다 — 게임은 하나씩
  await Promise.all([0].map(async () => {
    for (let g = queue.shift(); g; g = queue.shift()) {
      try { await writeSeries(g, (shots as Record<string, never>)[g.id], authorId) } catch (e) { console.error('❌', g.title, (e as Error).message) }
    }
  }))
  console.log('완료')
}
main()
