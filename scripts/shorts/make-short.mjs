// scripts/shorts/make-short.mjs — 스튜디오 프로젝트 하나를 9:16 홍보 쇼츠(MP4 1080×1920)로 만든다.
// 장면: 훅 → 프롬프트 타이핑 → AI 가 코드를 쓰는 화면 → 완성된 게임 자동 플레이 → vibrexcup.com 엔딩
// 실제 프로젝트의 첫 프롬프트·설명·완성 HTML 을 그대로 쓴다 (게임은 VIBREX_GAME 매니페스트로 자동 플레이).
//
//   node scripts/shorts/make-short.mjs <projectId> [--version N] [--hook "제목"] [--prompt "화면에 칠 문장"] [--music bgm.mp3] [--play 11000] [--out 폴더]
//   node scripts/shorts/make-short.mjs --latest 5          # 내 최근 프로젝트 5개를 한 번에
// ffmpeg 준비(한 번): mkdir -p ~/.cache/vibrax-shorts && cd ~/.cache/vibrax-shorts && npm i ffmpeg-static
//
// 결과: out/shorts/<날짜>-<제목>.mp4 + 같은 이름 .txt (업로드용 제목·설명·해시태그)
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PW = '/Users/sungjunahn/gstack/node_modules/playwright-core/index.mjs'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// ffmpeg: FFMPEG 환경변수 → ~/.cache/vibrax-shorts 의 독립 실행본(ffmpeg-static) → PATH 의 ffmpeg
const FFMPEG = process.env.FFMPEG || [path.join(process.env.HOME, '.cache/vibrax-shorts/node_modules/ffmpeg-static/ffmpeg')].find((f) => fs.existsSync(f)) || 'ffmpeg'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const OWNER = '766bb21e-5a51-4094-a763-cde9c883c196'   // --latest 기본: 운영 계정 프로젝트

// ---------- 인자 · 환경 ----------
const argv = process.argv.slice(2)
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const { createClient } = await import(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/index.mjs'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const OUT = path.resolve(opt('--out', path.join(ROOT, 'out/shorts')))
fs.mkdirSync(OUT, { recursive: true })

// ---------- 프로젝트 → 쇼츠 재료 ----------
const stripAttach = (s) => s.replace(/\n?\[\[ATTACH[\s\S]*$/, '').replace(/<!--attach[\s\S]*?-->/g, '').trim()
const cleanDesc = (s) => s.replace(/<game>[\s\S]*?(<\/game>|$)/g, '').replace(/\[\[[^\]]*\]\]/g, '').replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim()
async function load(projectId, version) {
  const { data: p, error } = await db.from('studio_projects').select('id,title').eq('id', projectId).single()
  if (error || !p) throw new Error('프로젝트를 찾지 못했어요: ' + projectId)
  let q = db.from('studio_versions').select('version,html,created_at').eq('project_id', projectId)
  q = version ? q.eq('version', version) : q.order('version', { ascending: false }).limit(1)
  const { data: vs } = await q
  const v = vs?.[0]; if (!v) throw new Error('버전이 없어요')
  const { data: msgs } = await db.from('studio_messages').select('role,content').eq('project_id', projectId).order('created_at')
  const first = (msgs ?? []).find((m) => m.role === 'user'), firstAi = (msgs ?? []).find((m) => m.role === 'assistant')
  // 화면에 칠 프롬프트: 첫 줄, '요청:' 같은 머리말 제거, 길면 문장·쉼표 경계에서 32자 안팎으로
  let prompt = stripAttach(first?.content ?? p.title).split('\n')[0].replace(/^\s*(요청|프롬프트|prompt)\s*[:：]\s*/i, '').trim()
  if (prompt.length > 34) {
    const head = prompt.slice(0, 34), end = Math.max(head.lastIndexOf('만들기') + 3, head.lastIndexOf('게임') + 2, head.search(/[.,!?·]\s*[^.,!?·]*$/))   // '…게임' · '…만들기' · 문장 끝에서 자른다
    prompt = (end > 6 ? head.slice(0, end) : head.replace(/\s+\S*$/, '')).trim()
  }
  if (opt('--prompt')) prompt = opt('--prompt')
  return { id: p.id, title: (v.html.match(/<title>([^<]{1,40})<\/title>/i)?.[1] ?? p.title).trim(), prompt, desc: cleanDesc(firstAi?.content ?? '').slice(0, 120), html: v.html, version: v.version }
}
const HOOKS = [
  (t) => [`한 줄 쓰면<br><em>게임이 완성</em>돼요`, '코딩 없이, 프롬프트 한 줄로'],
  (t) => [`<em>${t}</em><br>10초 만에 만들기`, 'AI 게임 메이커 vibrexcup'],
  (t) => [`이 게임,<br><em>한 문장</em>으로 만들었어요`, '직접 해 보세요 — 무료'],
]

// ---------- 게임 자동 플레이 봇 (게임 iframe 안에서 실행) ----------
// VIBREX_GAME 매니페스트: start() · phase() · state() · inputs{left,right,up,down,jump,fire,…} — 위험을 피하고 목표로 다가가며 주기적으로 행동
const BOT = `(() => {
  if (window.__bot) return; window.__bot = 1
  const G = () => window.VIBREX_GAME || {}
  const held = {}
  const press = (k, on) => { const f = G().inputs && G().inputs[k]; if (typeof f !== 'function' || held[k] === on) return; held[k] = on; try { f(on) } catch (e) {} }
  const tap = (k, ms) => { press(k, true); setTimeout(() => press(k, false), ms || 90) }
  const tapScreen = () => {   // 터치형 게임: 화면 아무 데나 탭 (가운데 아래쪽 위주)
    const c = document.querySelector('canvas') || document.body, r = c.getBoundingClientRect()
    const x = r.left + r.width * (0.15 + Math.random() * 0.7), y = r.top + r.height * (0.3 + Math.random() * 0.6)
    const el = document.elementFromPoint(x, y) || c
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }))
  }
  let n = 0
  setInterval(() => {
    const g = G(), ph = (() => { try { return g.phase && g.phase() } catch (e) { return null } })()
    if (!g.inputs && !g.start) { if (n++ % 4 === 0) tapScreen(); return }
    if (ph === 'title' || ph === 'over' || ph === 'cleared' || ph == null && n < 3) { try { (ph === 'over' && g.restart ? g.restart : g.start).call(g) } catch (e) {} ; tap('jump'); n++; return }
    const s = (() => { try { return g.state ? g.state() : {} } catch (e) { return {} } })() || {}
    const ins = g.inputs || {}
    if ('left' in ins || 'right' in ins) {
      let dir = 0
      if (typeof s.dangerDist === 'number' && s.dangerDist < 0.3 && typeof s.dangerDX === 'number') dir = s.dangerDX > 0 ? -1 : 1
      else if (typeof s.targetDX === 'number' && Math.abs(s.targetDX) > 0.05) dir = s.targetDX > 0 ? 1 : -1
      else dir = Math.sin(n / 9) > 0 ? 1 : -1
      press('left', dir < 0); press('right', dir > 0)
    }
    if ('jump' in ins && ((typeof s.dangerETA === 'number' && s.dangerETA < 0.25) || n % 7 === 0)) tap('jump', 160)
    if ('fire' in ins && n % 2 === 0) tap('fire')
    if ('up' in ins && 'down' in ins && !('left' in ins) && n % 5 === 0) tap(Math.random() < 0.5 ? 'up' : 'down')
    if (g.touchUI === 'none' || g.touchUI === 'custom' || Object.keys(ins).length === 0) { if (n % 3 === 0) tapScreen() }
    n++
  }, 120)
})()`

// ---------- 녹화 ----------
async function record(item, i) {
  const { chromium } = await import(PW)
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  const [h1, h2] = HOOKS[(opt('--hook-style') ? Number(opt('--hook-style')) : i) % HOOKS.length](item.title)
  const hook = opt('--hook') ?? h1
  const took = `${8 + Math.floor(Math.random() * 6)}초 만에 완성`
  const SHORT = { hook, hookSub: h2, prompt: item.prompt, desc: item.desc || `「${item.title}」 을(를) 만들었어요.`, code: item.html.replace(/data:[^"')]{200,}/g, 'data:…'), title: item.title, took,
    endH: '내 게임도<br>한 줄로 만들어 보세요', endP: '무료로 시작 · 웹 · Mac · Windows', timing: { hook: 2300, build: 4200, play: Number(opt('--play', 11000)), end: 2600 } }
  const scene = fs.readFileSync(path.join(HERE, 'scene.html'), 'utf8').replace('<script>', `<script>window.SHORT=${JSON.stringify(SHORT).replace(/</g, '\\u003c')}</script><script>`)
  const logo = fs.readFileSync(path.join(ROOT, 'public/icon-512.png'))
  await page.route('http://short.test/**', (r) => {
    const u = new URL(r.request().url())
    if (u.pathname === '/logo.png') return r.fulfill({ status: 200, contentType: 'image/png', body: logo })
    if (u.pathname === '/game.html') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: item.html })
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: scene })
  })
  await page.goto('http://short.test/', { waitUntil: 'load' })
  await page.waitForTimeout(800)

  // CDP 스크린캐스트로 프레임(JPEG)을 받아 타임스탬프 그대로 이어 붙인다 (Playwright 기본 녹화보다 선명)
  const tmp = fs.mkdtempSync(path.join(OUT, '.frames-'))
  const cdp = await ctx.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(tmp, String(frames.length).padStart(5, '0') + '.jpg')
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'))
    frames.push({ file, t: f.metadata.timestamp })
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch { /* 끝남 */ }
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 })
  const run = page.evaluate(() => window.runShort())
  // 게임 장면이 되면 iframe 에 봇을 심는다
  const botTimer = setInterval(async () => {
    try {
      if (!(await page.evaluate(() => !!window.__playing))) return
      const f = page.frames().find((x) => x.url().endsWith('/game.html'))
      if (f) await f.evaluate(BOT)
    } catch { /* 장면 전환 중 */ }
  }, 300)
  await run
  clearInterval(botTimer)
  const endT = Date.now() / 1000                          // 마지막 장면은 화면이 안 바뀌어 프레임이 안 오므로 끝 시각을 따로 잡는다
  await cdp.send('Page.stopScreencast')
  await browser.close()

  // 프레임 → MP4 (프레임별 실제 표시 시간으로 concat, 30fps 로 고정)
  const list = frames.map((f, k) => `file '${f.file}'\nduration ${Math.max(0.001, ((frames[k + 1]?.t ?? Math.max(f.t + 0.1, endT)) - f.t)).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`
  fs.writeFileSync(path.join(tmp, 'list.txt'), list)
  const day = new Date().toISOString().slice(0, 10)
  const base = path.join(OUT, `${day}-${item.title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30)}`)
  // --music 파일.mp3 를 주면 배경음을 깔고 끝에서 1.5초 페이드아웃 (없으면 무음 — 업로드할 때 플랫폼 음원을 붙여도 됨)
  const music = opt('--music'), dur = (frames.length ? Math.max(endT, frames[frames.length - 1].t) - frames[0].t : 0)
  const ff = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
    ...(music ? ['-stream_loop', '-1', '-i', music, '-filter_complex', `[1:a]volume=0.8,afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(2)}:d=1.5[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
    '-vf', 'scale=1080:1920:flags=lanczos,setsar=1,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', base + '.mp4'], { stdio: 'inherit' })
  fs.rmSync(tmp, { recursive: true, force: true })
  if (ff.status !== 0) throw new Error('ffmpeg 실패')

  const tags = '#AI게임 #게임만들기 #바이브코딩 #노코드 #인디게임 #vibrexcup #shorts'
  fs.writeFileSync(base + '.txt', `[제목]\n${item.prompt} → 한 줄로 게임 완성 🎮 #shorts\n\n[설명]\n"${item.prompt}" 한 줄을 쓰면 AI 가 「${item.title}」 게임을 만들어 줘요.\n코딩 없이 무료로 만들어 보세요 👉 https://vibrexcup.com\n\n${tags}\n`)
  return { file: base + '.mp4', frames: frames.length, errors: errs }
}

// ---------- 실행 ----------
let ids = argv.filter((a, k) => /^[0-9a-f-]{36}$/i.test(a) && !['--version', '--hook', '--out', '--play', '--hook-style', '--music', '--user', '--latest', '--prompt'].includes(argv[k - 1]))
const latest = Number(opt('--latest', 0))
if (latest) {
  const { data } = await db.from('studio_projects').select('id').eq('user_id', opt('--user', OWNER)).order('created_at', { ascending: false }).limit(latest)
  ids = (data ?? []).map((r) => r.id)
}
if (!ids.length) { console.log('사용법: node scripts/shorts/make-short.mjs <projectId> [--version N] [--hook "제목"]  |  --latest 5'); process.exit(1) }
for (const [i, id] of ids.entries()) {
  try {
    const item = await load(id, Number(opt('--version', 0)) || null)
    console.log(`▶ ${item.title} (v${item.version}) — "${item.prompt}"`)
    const r = await record(item, i)
    console.log(`  ✓ ${path.relative(ROOT, r.file)} · ${r.frames} 프레임${r.errors.length ? ' · 페이지 오류 ' + r.errors.length : ''}`)
  } catch (e) { console.error(`  ✗ ${id}: ${e.message}`) }
}
