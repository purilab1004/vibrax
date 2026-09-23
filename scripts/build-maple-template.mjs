// scripts/build-maple-template.mjs — ~/Documents/maple 의 여러 파일 게임을 '단일 HTML 템플릿'으로 묶는다.
//   · style.css / js/*.js 를 인라인
//   · 스프라이트는 용량이 커서 data URI 대신 우리 도메인(/maple/*.png)에서 받는다
//   · 플랫폼 표준 래퍼 추가: 시작 버튼(data-vibrex-role) · VIBREX_GAME 매니페스트(모바일 조이스틱·AI 플레이용)
//   사용: node scripts/build-maple-template.mjs [베이스URL]   (기본 https://vibrexcup.com/maple)
import fs from 'node:fs'
import path from 'node:path'

const SRC = process.env.MAPLE_DIR || '/Users/sungjunahn/Documents/maple'
const BASE = process.argv[2] || 'https://vibrexcup.com/maple'
const OUT = process.env.MAPLE_OUT || '/tmp/maple-template.html'

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8')
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])

html = html.replace(/<link rel="stylesheet" href="style\.css"\s*\/?>/, `<style>\n${css}\n</style>`)
for (const rel of scripts) {
  const code = fs.readFileSync(path.join(SRC, rel), 'utf8')
  html = html.replace(`<script src="${rel}"></script>`, `<script>\n${code}\n</script>`)
}
// 스프라이트 경로 → 우리 도메인
html = html.replace(/(["'`])assets\/sprites\//g, `$1${BASE}/`)

// ── 플랫폼 표준 래퍼 ──
// 이 게임은 '캐릭터 만들기' 화면에서 시작한다 → 그 버튼에 표준 역할을 달고, 매니페스트로 조작을 연결한다
const WRAP = `
<script>
(function () {
  // 시작 버튼 표준 — 플랫폼(오토파일럿·튜토리얼)이 시작을 인식하게
  var start = document.getElementById('create-start');
  if (start) { start.setAttribute('data-vibrex-role', 'start'); start.id = start.id || 'vibrex-start'; }
  // 키 이벤트로 조작을 전달한다(게임은 window 의 keydown/keyup 과 e.code 를 본다)
  var KEY = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space', fire: 'KeyZ', guard: 'KeyX', useItem: 'KeyI' };
  var held = {};
  function send(code, on) {
    if (!!held[code] === on) return; held[code] = on;
    try { window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: code, key: code === 'Space' ? ' ' : code, bubbles: true })) } catch (e) {}
  }
  var inputs = {};
  Object.keys(KEY).forEach(function (name) { inputs[name] = function (on) { send(KEY[name], !!on) } });
  function num(id) { var el = document.getElementById(id); var v = el ? parseInt(el.textContent, 10) : 0; return isFinite(v) ? v : 0 }
  window.VIBREX_GAME = {
    title: '메이플 어드벤처', genre: 'rpg',
    goal: '몬스터를 사냥해 레벨을 올리고 장비를 모아 더 강한 맵으로 나아가라',
    clearCondition: '레벨 20 달성 · 보스 처치',
    controls: [
      { input: 'ArrowLeft/ArrowRight', action: '이동' }, { input: 'Space', action: '점프 (↓+Space 아래로)' },
      { input: 'KeyZ', action: '공격' }, { input: 'KeyX', action: '스킬' }, { input: 'ArrowUp', action: '포탈·NPC 대화' }, { input: 'KeyI', action: '아이템' },
    ],
    buttons: { jump: 'JUMP', fire: 'ATK', guard: 'SKILL', useItem: 'ITEM' },
    phase: function () {
      var create = document.getElementById('create');
      if (create && !create.classList.contains('hidden')) return 'title';
      var over = document.getElementById('dead') || document.querySelector('.dead:not(.hidden)');
      if (over && !over.classList.contains('hidden')) return 'over';
      return 'playing';
    },
    state: function () { return { level: num('lv'), hp: num('hptext'), mp: num('mptext'), coins: num('coins'), atk: num('atk'), def: num('def') } },
    stateDoc: { level: '현재 레벨', hp: '남은 체력', mp: '남은 마나', coins: '보유 코인', atk: '공격력', def: '방어력' },
    rules: ['몬스터를 공격(Z)해 경험치와 코인을 얻는다', '레벨이 오르면 체력·공격력이 올라간다', '포탈(↑)로 다음 맵에 간다', 'HP 가 0 이 되면 사망', '물약(1·2·3)으로 회복한다'],
    tips: ['먼저 약한 몬스터로 레벨을 올린 뒤 다음 맵으로', '스킬(X)은 마나를 쓰지만 피해가 크다', '장비를 갈아끼우면 공격력·방어력이 오른다'],
    inputs: inputs,
    start: function () { var b = document.getElementById('create-start'); if (b) b.click() },
    restart: function () { location.reload() },
  };
})();
</script>`
html = html.replace(/<\/body>/i, WRAP + '\n</body>')
fs.writeFileSync(OUT, html)
console.log('✓', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB', '| 인라인 스크립트', scripts.length, '개 | 스프라이트 base:', BASE)
