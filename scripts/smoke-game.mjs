// scripts/smoke-game.mjs — 생성된 게임 HTML 을 실제 브라우저(헤드리스 Chrome)에서 돌려 보는 실행 테스트.
// 저장 전에 "정말 돌아가는 게임인지" 확인하려고 워커(scripts/max-worker.ts)가 호출한다.
//   사용법: node scripts/smoke-game.mjs <html파일> [--json]
//   결과(JSON): { ok, errors[], warnings[], phase, ticks, started, cleared }
// 검사: 로드 중 예외 · 매니페스트(VIBREX_GAME) · START 후 playing 전환 · 프레임이 실제로 도는지(rAF)
import fs from 'node:fs'

const PW = '/Users/sungjunahn/gstack/node_modules/playwright-core/index.mjs'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function smokeGame(html, { timeoutMs = 45_000 } = {}) {
  const { chromium } = await import(PW)
  const errors = [], warnings = []
  let browser
  try {
    browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
    const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => errors.push(`실행 오류: ${String(e.message || e).slice(0, 300)}`))
    page.on('console', (m) => { if (m.type() === 'error') warnings.push(`콘솔 오류: ${m.text().slice(0, 200)}`) })

    // 프레임이 실제로 도는지 세어 둔다(멈춘 게임 잡기) — 게임 스크립트보다 먼저 실행되도록 문서 맨 앞에 심는다
    const TICKER = '<script>window.__ticks=0;(function(){var r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(cb){return r(function(t){window.__ticks++;return cb(t)})}})()<\/script>'
    const i = html.search(/<head[^>]*>/i)
    const doc = i >= 0 ? html.slice(0, html.indexOf('>', i) + 1) + TICKER + html.slice(html.indexOf('>', i) + 1) : TICKER + html
    await page.setContent(doc, { waitUntil: 'load', timeout: timeoutMs })
    await page.waitForTimeout(1500)

    const before = await page.evaluate(() => ({
      manifest: !!window.VIBREX_GAME,
      phase: (() => { try { return window.VIBREX_GAME?.phase?.() ?? null } catch { return 'phase() 오류' } })(),
      hasStart: !!document.querySelector('[data-vibrex-role="start"], #vibrex-start'),
      canvases: document.querySelectorAll('canvas').length,
      bodyText: (document.body?.innerText ?? '').trim().length,
    }))
    if (!before.manifest) warnings.push('window.VIBREX_GAME 매니페스트가 없어요(AI 플레이·오토파일럿이 게임을 이해하지 못해요)')
    if (!before.hasStart) warnings.push('시작 버튼(data-vibrex-role="start")이 없어요')
    if (!before.canvases && !before.bodyText) errors.push('화면에 아무것도 그려지지 않았어요(캔버스·내용 없음)')

    // 시작 — 표준 버튼 → 매니페스트 start() → 화면 탭 순서로 시도
    await page.evaluate(() => {
      const b = document.querySelector('[data-vibrex-role="start"], #vibrex-start')
      if (b) { b.click(); return }
      try { window.VIBREX_GAME?.start?.() } catch { /* noop */ }
    })
    await page.waitForTimeout(600)
    let phase = await page.evaluate(() => { try { return window.VIBREX_GAME?.phase?.() ?? null } catch { return null } })
    if (phase === 'title') {   // 버튼이 안 먹으면 화면 탭·스페이스로 한 번 더
      await page.mouse.click(195, 420).catch(() => {})
      await page.keyboard.press('Space').catch(() => {})
      await page.waitForTimeout(600)
      phase = await page.evaluate(() => { try { return window.VIBREX_GAME?.phase?.() ?? null } catch { return null } })
    }

    const t0 = await page.evaluate(() => window.__ticks)
    // 플레이 중 조작도 넣어 본다 — 입력을 받다가 터지는 게임을 잡는다
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']) { await page.keyboard.press(k).catch(() => {}); await page.waitForTimeout(120) }
    await page.waitForTimeout(1800)
    const t1 = await page.evaluate(() => window.__ticks)
    const ticks = Number.isFinite(t1 - t0) ? t1 - t0 : -1
    const after = await page.evaluate(() => {
      let phase = null, state = null
      try { phase = window.VIBREX_GAME?.phase?.() ?? null } catch { /* noop */ }
      try { state = window.VIBREX_GAME?.state?.() ?? null } catch { /* noop */ }
      return { phase, state }
    })

    if (before.manifest && phase === 'title' && after.phase === 'title') errors.push('시작 버튼을 눌러도 게임이 시작되지 않아요(phase 가 title 그대로)')
    if (ticks < 0) warnings.push('프레임 수를 재지 못했어요')
    else if (ticks < 20) errors.push(`화면이 멈춰 있어요(2초 동안 프레임 ${ticks}회 — 최소 20회 기대)`)
    // 화면이 정말 그려졌는지 — 스크린샷이 단색이면 빈 화면
    try {
      const shot = await page.screenshot({ type: 'png' })
      const { default: sharp } = await import('sharp')
      const st = await sharp(shot).stats()
      const flat = st.channels.every((c) => c.stdev < 1.2)
      if (flat) errors.push('게임 화면이 단색이에요(아무것도 그려지지 않음)')
    } catch { /* 스크린샷 검사 실패는 무시 */ }
    if (after.phase === 'over') warnings.push('시작하자마자 게임오버가 됐어요(난이도·충돌 판정 확인 필요)')

    return { ok: errors.length === 0, errors, warnings: warnings.slice(0, 6), phase: after.phase ?? phase, ticks, manifest: before.manifest, state: after.state }
  } catch (e) {
    return { ok: false, errors: [`실행 테스트를 하지 못했어요: ${String(e?.message ?? e).slice(0, 200)}`], warnings, phase: null, ticks: 0 }
  } finally {
    try { await browser?.close() } catch { /* noop */ }
  }
}

// CLI 로 직접 실행할 때
if (process.argv[1] && process.argv[1].endsWith('smoke-game.mjs')) {
  const file = process.argv[2]
  if (!file) { console.error('사용법: node scripts/smoke-game.mjs <html파일>'); process.exit(2) }
  const r = await smokeGame(fs.readFileSync(file, 'utf8'))
  if (process.argv.includes('--json')) console.log(JSON.stringify(r))
  else {
    console.log(r.ok ? '✅ 실행 테스트 통과' : '❌ 실행 테스트 실패')
    for (const e of r.errors) console.log('  ·', e)
    for (const w of r.warnings) console.log('  (주의)', w)
    console.log(`  phase=${r.phase} frames=${r.ticks} manifest=${r.manifest}`)
  }
  process.exit(r.ok ? 0 : 1)
}
