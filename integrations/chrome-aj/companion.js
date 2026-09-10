// Vibrexcup AJ — 페이지 위 캐릭터(content script). Shadow DOM 으로 격리되어 사이트 CSS 와 섞이지 않는다.
// 바닥을 걸어 다니고, 깜빡이고, 클릭하면 말풍선으로 대화, 드래그로 옮기기, 브라우저 음성(선택).
;(() => {
  if (window.__vbxAJ) { window.__vbxAJ.show(); return }
  const SIZE = 96
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:"Pretendard Variable",-apple-system,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif}
  .aj{position:fixed;left:0;bottom:0;width:${SIZE}px;height:${SIZE + 24}px;z-index:2147483646;pointer-events:none;user-select:none;-webkit-user-select:none;transition:none}
  .body{position:absolute;left:0;bottom:0;width:${SIZE}px;height:${SIZE}px;pointer-events:auto;cursor:grab;filter:drop-shadow(0 8px 14px rgba(0,0,0,.28));transform-origin:50% 100%}
  .body.dragging{cursor:grabbing}
  .body img{width:100%;height:100%;object-fit:contain;object-position:bottom;display:block;pointer-events:none;transition:transform .12s}
  .body.flip img{transform:scaleX(-1)}
  .body.bob{animation:bob 1.6s ease-in-out infinite}
  .body.walk{animation:walk .45s ease-in-out infinite}
  .body.jump{animation:jump .55s cubic-bezier(.3,0,.2,1)}
  .body.talking{animation:talk .28s steps(2) infinite}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes walk{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-5px) rotate(2deg)}}
  @keyframes jump{0%{transform:translateY(0)}45%{transform:translateY(-38px) scaleY(1.05)}100%{transform:translateY(0)}}
  @keyframes talk{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-2px) scale(1.03)}}
  .shadow{position:absolute;left:12px;bottom:-2px;width:${SIZE - 24}px;height:10px;border-radius:50%;background:rgba(0,0,0,.22);filter:blur(3px)}
  .bubble{position:absolute;bottom:${SIZE + 8}px;left:50%;transform:translateX(-50%);min-width:180px;max-width:300px;background:#fff;color:#241f17;border:1px solid #e6dfd0;border-radius:16px;padding:10px 12px;font-size:13px;line-height:1.5;box-shadow:0 12px 30px -10px rgba(36,31,23,.35);pointer-events:auto;white-space:pre-wrap;word-break:break-word;opacity:0;visibility:hidden;transition:opacity .18s}
  .bubble.on{opacity:1;visibility:visible}
  .bubble::after{content:"";position:absolute;left:50%;bottom:-7px;width:12px;height:12px;background:#fff;border-right:1px solid #e6dfd0;border-bottom:1px solid #e6dfd0;transform:translateX(-50%) rotate(45deg)}
  .bubble .name{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;color:#F05A28;margin-bottom:2px}
  .bubble .txt{display:block}
  .bubble .cursor{display:inline-block;width:5px;height:11px;background:#F05A28;margin-left:2px;vertical-align:middle;animation:blink 1s steps(2) infinite}
  @keyframes blink{to{opacity:0}}
  .chat{position:absolute;bottom:${SIZE + 8}px;left:50%;transform:translateX(-50%);width:300px;background:#fff;border:1px solid #e6dfd0;border-radius:16px;padding:10px;box-shadow:0 12px 30px -10px rgba(36,31,23,.35);pointer-events:auto;display:none;flex-direction:column;gap:8px}
  .chat.on{display:flex}
  .chat textarea{width:100%;resize:none;border:1px solid #cfc4ab;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;height:60px;background:#fff;color:#241f17}
  .chat textarea:focus{outline:2px solid #2563eb;outline-offset:1px}
  .row{display:flex;gap:6px;align-items:center;justify-content:space-between}
  .row label{font-size:11px;color:#857a68;display:flex;align-items:center;gap:4px;cursor:pointer}
  .btn{height:30px;padding:0 12px;border-radius:8px;border:0;font:inherit;font-size:12px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff}
  .btn.ghost{background:#f5efe3;color:#241f17}
  .btn:disabled{opacity:.5;cursor:default}
  .x{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#241f17;color:#fff;border:0;font-size:12px;line-height:20px;text-align:center;cursor:pointer;pointer-events:auto;opacity:0;transition:opacity .15s}
  .aj:hover .x{opacity:1}
  .hint{position:absolute;bottom:${SIZE + 8}px;left:50%;transform:translateX(-50%);font-size:11px;color:#fff;background:rgba(36,31,23,.8);padding:3px 8px;border-radius:999px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}
  .aj.idle:hover .hint{opacity:1}
  @media (prefers-reduced-motion:reduce){.body{animation:none!important}}
  `

  const host = document.createElement('div'); host.id = 'vbx-aj-host'; host.style.all = 'initial'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `<style>${CSS}</style>
  <div class="aj idle">
    <div class="hint">클릭해서 말 걸기 · 드래그로 옮기기</div>
    <div class="bubble"><span class="name"></span><span class="txt"></span></div>
    <div class="chat">
      <textarea placeholder="AJ에게 말 걸기… (Enter 전송)"></textarea>
      <div class="row"><label><input type="checkbox" class="ctx" checked> 이 페이지 보여주기</label><div><button class="btn ghost close">닫기</button> <button class="btn send">보내기</button></div></div>
    </div>
    <div class="body bob"><img alt=""><div class="shadow"></div></div>
    <button class="x" title="숨기기">×</button>
  </div>`
  document.documentElement.appendChild(host)
  const $ = (s) => root.querySelector(s)
  const el = { aj: $('.aj'), body: $('.body'), img: $('img'), bubble: $('.bubble'), bname: $('.bubble .name'), btxt: $('.bubble .txt'), chat: $('.chat'), ta: $('textarea'), ctx: $('.ctx'), send: $('.send'), close: $('.close'), x: $('.x') }

  const state = { me: null, frames: null, x: 0, dir: 1, walking: false, talking: false, history: [], busy: false, settings: {}, timers: [], hidden: false }
  const vw = () => document.documentElement.clientWidth
  const setX = (x) => { state.x = Math.max(0, Math.min(vw() - SIZE, x)); el.aj.style.transform = `translateX(${state.x}px)` }
  const frame = (k) => { if (state.frames?.[k]) el.img.src = state.frames[k] }
  const later = (fn, ms) => { const t = setTimeout(fn, ms); state.timers.push(t); return t }

  // ── 말풍선 / 음성 ──
  let bubbleTimer = null
  function say(text, { hold = 6000, stream = false } = {}) {
    el.bname.textContent = (state.me?.name || 'AJ').toUpperCase()
    el.btxt.textContent = text
    el.bubble.classList.add('on'); clearTimeout(bubbleTimer)
    if (!stream) bubbleTimer = setTimeout(() => el.bubble.classList.remove('on'), hold)
  }
  function speak(text) {
    if (!state.settings.ajVoice || !('speechSynthesis' in window) || !text) return
    try { const u = new SpeechSynthesisUtterance(text); u.lang = /[가-힣]/.test(text) ? 'ko-KR' : 'en-US'; u.rate = 1.05; u.pitch = state.me?.voice === 'male' ? 0.85 : 1.15; const v = speechSynthesis.getVoices().find(v => v.lang === u.lang); if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u) } catch { /* ignore */ }
  }

  // ── 걷기 / 깜빡임 / 점프 ──
  function walkTo(target, done) {
    if (state.talking) return done && done()
    state.walking = true; el.body.classList.remove('bob'); el.body.classList.add('walk')
    state.dir = target > state.x ? 1 : -1; el.body.classList.toggle('flip', state.dir < 0)
    const speed = 1.6
    const step = () => {
      if (!state.walking) return
      const nx = state.x + speed * state.dir
      if ((state.dir > 0 && nx >= target) || (state.dir < 0 && nx <= target)) { setX(target); stopWalk(); return done && done() }
      setX(nx); requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  function stopWalk() { state.walking = false; el.body.classList.remove('walk'); el.body.classList.add('bob') }
  function idleLoop() {
    later(() => {
      if (state.hidden) return
      if (!state.talking && !el.chat.classList.contains('on') && !dragging) {
        const r = Math.random()
        if (r < 0.55) walkTo(Math.random() * (vw() - SIZE), idleLoop)
        else if (r < 0.7) { el.body.classList.add('jump'); later(() => el.body.classList.remove('jump'), 600); idleLoop() }
        else idleLoop()
      } else idleLoop()
    }, 2500 + Math.random() * 6000)
  }
  function blinkLoop() { later(() => { if (!state.talking) { frame('blink'); later(() => { if (!state.talking) frame('preview') }, 140) } blinkLoop() }, 2200 + Math.random() * 3000) }
  function talkAnim(on) { state.talking = on; el.body.classList.toggle('talking', on); frame(on ? 'talk' : 'preview'); if (on) { state.walking = false; el.body.classList.remove('walk') } }

  // ── 드래그 ──
  let dragging = false, dragDX = 0, moved = false
  const onDown = (e) => { const p = e.touches ? e.touches[0] : e; dragging = true; moved = false; dragDX = p.clientX - state.x; state.walking = false; el.body.classList.add('dragging'); el.body.classList.remove('walk', 'bob'); e.preventDefault() }
  const onMove = (e) => { if (!dragging) return; const p = e.touches ? e.touches[0] : e; const nx = p.clientX - dragDX; if (Math.abs(nx - state.x) > 2) moved = true; setX(nx) }
  const onUp = () => { if (!dragging) return; dragging = false; el.body.classList.remove('dragging'); el.body.classList.add('bob'); chrome.runtime.sendMessage({ type: 'setSettings', settings: { ajPos: state.x / Math.max(1, vw()) } }); if (!moved) toggleChat() }
  el.body.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  el.body.addEventListener('touchstart', onDown, { passive: false }); window.addEventListener('touchmove', onMove, { passive: true }); window.addEventListener('touchend', onUp)
  window.addEventListener('resize', () => setX(state.x))

  // ── 대화 ──
  function toggleChat(force) {
    const on = force ?? !el.chat.classList.contains('on')
    el.chat.classList.toggle('on', on); el.aj.classList.toggle('idle', !on)
    if (on) { el.bubble.classList.remove('on'); state.walking = false; el.body.classList.remove('walk'); el.body.classList.add('bob'); setTimeout(() => el.ta.focus(), 50) }
  }
  function pageContext() {
    if (!el.ctx.checked) return null
    return { title: document.title, url: location.href, text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 1500) }
  }
  function send(text) {
    text = (text || '').trim(); if (!text || state.busy) return
    state.busy = true; el.send.disabled = true; el.ta.value = ''
    toggleChat(false); say('', { stream: true }); el.btxt.innerHTML = '<span class="cursor"></span>'; talkAnim(true)
    let full = ''
    const port = chrome.runtime.connect({ name: 'aj-chat' })
    port.onMessage.addListener((m) => {
      if (m.chunk) { full += m.chunk; el.btxt.textContent = full; const c = document.createElement('span'); c.className = 'cursor'; el.btxt.appendChild(c) }
      if (m.error) { el.btxt.textContent = `⚠ ${m.error}`; finish() }
      if (m.done) { el.btxt.textContent = full; state.history.push({ role: 'user', content: text }, { role: 'assistant', content: full }); state.history = state.history.slice(-12); speak(full); finish() }
    })
    port.onDisconnect.addListener(() => { if (state.busy) finish() })
    const finish = () => { state.busy = false; el.send.disabled = false; talkAnim(false); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => el.bubble.classList.remove('on'), Math.min(20000, 4000 + full.length * 60)); try { port.disconnect() } catch { /* */ } }
    port.postMessage({ message: text, history: state.history, context: pageContext() })
  }
  el.send.addEventListener('click', () => send(el.ta.value))
  el.ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(el.ta.value) } if (e.key === 'Escape') toggleChat(false) })
  el.close.addEventListener('click', () => toggleChat(false))
  el.bubble.addEventListener('click', () => { el.bubble.classList.remove('on'); toggleChat(true) })
  el.x.addEventListener('click', () => hide())

  function hide() { state.hidden = true; state.timers.forEach(clearTimeout); state.timers = []; host.remove(); try { speechSynthesis.cancel() } catch { /* */ } }
  function show() { if (!state.hidden) return; state.hidden = false; document.documentElement.appendChild(host); idleLoop(); blinkLoop() }
  window.__vbxAJ = { show, hide }

  // ── 시작 ──
  chrome.runtime.sendMessage({ type: 'getSettings' }, (r) => { state.settings = r?.settings || {}
    chrome.runtime.sendMessage({ type: 'me' }, (res) => {
      if (!res?.ok) { host.remove(); return }
      state.me = res.me; state.frames = res.me.frames; frame('preview')
      const pos = typeof state.settings.ajPos === 'number' ? state.settings.ajPos * vw() : vw() * 0.8
      setX(pos)
      // 등장: 화면 아래에서 점프하며 올라옴
      el.body.classList.add('jump'); later(() => el.body.classList.remove('jump'), 600)
      later(() => { say(state.me.greeting || '안녕!'); speak(state.me.greeting || '') }, 500)
      idleLoop(); blinkLoop()
      // 페이지 보면 한마디 (설정 on 일 때만, 페이지당 1회) — 무료 할당량을 씀
      if (state.settings.ajAutoComment) later(() => { if (!state.busy) { el.ctx.checked = true; send('지금 보고 있는 페이지 보고 한마디 해줘 (짧게)') } }, 6000)
    })
  })
})()
