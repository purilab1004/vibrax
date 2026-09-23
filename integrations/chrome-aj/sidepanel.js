// Vibrexcup AJ — 사이드 패널: 대화 · 미니게임 · 학습(퀴즈/설명). 브라우징하면서 옆에 두고 쓴다.
const API = 'https://vibrexcup.com/api/v1/aj'
const SITE = 'https://vibrexcup.com'
const EXT_HEADER = { 'X-Vibrex-Ext': `chrome-aj/${chrome.runtime.getManifest().version}` }
const $ = (id) => document.getElementById(id)
const el = {
  setup: $('setup'), key: $('key'), save: $('save'), setupErr: $('setup-err'), gear: $('gear'), summon: $('summon'), tabs: $('tabs'),
  avatar: $('avatar'), name: $('name'), sub: $('sub'),
  chat: $('chat'), log: $('log'), form: $('form'), msg: $('msg'), send: $('send'), usectx: $('usectx'), pagechip: $('pagechip'), quota: $('quota'),
  game: $('game'), gamepick: $('gamepick'), mygames: $('mygames'), topgames: $('topgames'), gameplay: $('gameplay'), gameback: $('gameback'), gametitle: $('gametitle'), gamelink: $('gamelink'), gameframe: $('gameframe'), gamesay: $('gamesay'),
  learn: $('learn'), learnpage: $('learnpage'), btnExplain: $('btn-explain'), btnQuiz: $('btn-quiz'), btnReset: $('btn-learnreset'), learnlog: $('learnlog'), learnform: $('learnform'), learnmsg: $('learnmsg'), learnsend: $('learnsend'),
}
const state = { key: null, me: null, history: [], learnHistory: [], busy: false, tab: 'chat', page: null, gameTimer: null }
const store = { get: (k) => new Promise(r => chrome.storage.sync.get(k, r)), set: (o) => new Promise(r => chrome.storage.sync.set(o, r)) }

// ── 공통 ──
function show(setup) { el.setup.hidden = !setup; el.tabs.hidden = setup; setTab(state.tab) ; if (setup) { el.chat.hidden = el.game.hidden = el.learn.hidden = true } }
function setTab(t) {
  state.tab = t
  for (const b of el.tabs.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.tab === t)
  el.chat.hidden = t !== 'chat'; el.game.hidden = t !== 'game'; el.learn.hidden = t !== 'learn'
  if (t === 'game' && !el.mygames.childElementCount) loadGames()
  if (t === 'learn') refreshPage()
}
function addMsg(log, role, text) {
  const d = document.createElement('div'); d.className = `m ${role}`
  if (role === 'aj') { const t = document.createElement('span'); t.className = 'tag'; t.textContent = (state.me?.name || 'AJ').toUpperCase(); d.appendChild(t) }
  const s = document.createElement('span'); s.textContent = text; d.appendChild(s)
  log.appendChild(d); log.scrollTop = log.scrollHeight; return s
}
async function fetchMe() {
  const r = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${state.key}`, ...EXT_HEADER } })
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`) }
  return r.json()
}
function renderMe() {
  const m = state.me; if (!m) return
  el.name.textContent = m.name; el.sub.textContent = m.persona || (m.owner ? `${m.owner}의 AJ` : 'vibrexcup.com')
  if (m.avatar?.preview) { el.avatar.src = m.avatar.preview; el.avatar.hidden = false }
  el.quota.textContent = `오늘 ${m.quota?.today ?? 0}/${m.quota?.daily ?? '-'}회 · 무료`
}
async function connect(key) {
  state.key = key
  try { state.me = await fetchMe(); await store.set({ ajKey: key }); renderMe(); show(false); return true }
  catch (e) { el.setupErr.textContent = e.message.includes('extension') ? '이 키는 확장 전용 키가 아니에요. 내 정보 → AJ API에서 “크롬 확장 키”를 발급하세요.' : `연결 실패: ${e.message}`; el.setupErr.hidden = false; show(true); return false }
}

// ── 현재 탭 컨텍스트 (사이드 패널은 activeTab 이 자동 부여되지 않으므로 <all_urls> 선택 권한이 있으면 본문까지, 없으면 제목·URL 만) ──
async function activeTab() { const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return tab || null }
async function pageContext() {
  const tab = await activeTab(); if (!tab?.id) return null
  const url = tab.url || '', title = tab.title || ''
  if (!/^https?:/.test(url)) return null
  let text = ''
  try { const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 1500) }); text = r?.result || '' } catch { /* 권한 없음 → 제목·URL 만 */ }
  return { title, url, text }
}
async function refreshPage() {
  const tab = await activeTab()
  state.page = tab && /^https?:/.test(tab.url || '') ? { title: tab.title || '', url: tab.url || '' } : null
  el.learnpage.textContent = state.page ? `📄 ${state.page.title || state.page.url}` : '이 탭은 읽을 수 없어요 (chrome:// 등)'
  if (state.page) { el.pagechip.textContent = (state.page.title || state.page.url).slice(0, 28); el.pagechip.hidden = false } else el.pagechip.hidden = true
  const has = await chrome.permissions.contains({ origins: ['<all_urls>'] })
  if (!has && state.page) el.learnpage.textContent += ' · 본문까지 읽으려면 권한 허용'
}
async function ensurePageAccess() {
  const has = await chrome.permissions.contains({ origins: ['<all_urls>'] }); if (has) return true
  return chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false)
}

// ── 스트리밍 대화 (공통) ──
async function ask({ text, log, history, mode = 'chat', context, onDone }) {
  if (state.busy || !text.trim()) return
  state.busy = true; el.send.disabled = el.learnsend.disabled = true
  const target = addMsg(log, 'aj', ''); const cur = document.createElement('span'); cur.className = 'typing'; target.parentElement.appendChild(cur)
  let full = ''
  try {
    const r = await fetch(`${API}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${state.key}`, 'Content-Type': 'application/json', ...EXT_HEADER }, body: JSON.stringify({ message: text, history: history.slice(-10), context, mode, stream: true }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error === 'daily quota exceeded' ? '오늘 무료 횟수를 다 썼어요. 내일 다시!' : (j.error || `HTTP ${r.status}`)) }
    const reader = r.body.getReader(), dec = new TextDecoder()
    for (;;) { const { value, done } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); target.textContent = full; log.scrollTop = log.scrollHeight }
    const q = r.headers.get('X-AJ-Quota'); if (q) el.quota.textContent = `오늘 ${q}회 · 무료`
    history.push({ role: 'user', content: text }, { role: 'assistant', content: full }); history.splice(0, Math.max(0, history.length - 20))
    onDone && onDone(full)
  } catch (e) { target.textContent = full || `⚠ ${e.message}` }
  finally { cur.remove(); state.busy = false; el.send.disabled = el.learnsend.disabled = false }
}

// ── 대화 탭 ──
async function sendChat(text) {
  text = text.trim(); if (!text) return
  addMsg(el.log, 'user', text); el.msg.value = ''
  const context = el.usectx.checked ? await pageContext() : null
  await ask({ text, log: el.log, history: state.history, context, onDone: () => store.set({ ajHistory: state.history }) })
}
el.form.addEventListener('submit', (e) => { e.preventDefault(); sendChat(el.msg.value) })
el.msg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(el.msg.value) } })
el.usectx.addEventListener('change', async () => { if (el.usectx.checked) await ensurePageAccess(); store.set({ ajUseCtx: el.usectx.checked }) })

// ── 게임 탭 ──
function card(g, embed) {
  const d = document.createElement('button'); d.className = 'gcard'; d.type = 'button'
  d.innerHTML = `<span class="thumb" style="${g.thumbnail_url || g.thumbnail ? `background-image:url('${(g.thumbnail_url || g.thumbnail)}')` : ''}"></span><span class="gt">${esc(g.title)}</span><span class="gg">${esc(g.genre || '')}${g.teaser ? ' · ' + esc(g.teaser) : ''}</span>`
  d.addEventListener('click', () => playGame(g.title, embed, `${SITE}/games/${g.id}`))
  return d
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
async function loadGames() {
  el.mygames.innerHTML = ''; el.topgames.innerHTML = ''
  const mine = (state.me?.games || []).filter(g => g.embedUrl)
  if (!mine.length) el.mygames.innerHTML = '<p class="empty">아직 만든 게임이 없어요. <a href="https://vibrexcup.com/studio" target="_blank" rel="noopener">스튜디오에서 만들기 ↗</a></p>'
  for (const g of mine) el.mygames.appendChild(card(g, g.embedUrl))
  try {
    const r = await fetch(`${SITE}/api/catalog`); const j = await r.json()
    const list = (j.games || j || []).filter(g => g.embed_url).slice(0, 12)
    for (const g of list) el.topgames.appendChild(card(g, g.embed_url))
  } catch { el.topgames.innerHTML = '<p class="empty">인기 게임을 불러오지 못했어요.</p>' }
}
function playGame(title, embed, link) {
  el.gamepick.hidden = true; el.gameplay.hidden = false
  el.gametitle.textContent = title; el.gamelink.href = link
  el.gameframe.src = embed
  el.gamesay.textContent = ''
  clearTimeout(state.gameTimer)
  // AJ 훈수: 시작 15초 뒤 한마디 (game 모드, 무료 횟수 1회)
  state.gameTimer = setTimeout(() => cheer(`지금 「${title}」 하는 중이야. 한마디 해줘`), 15000)
}
async function cheer(text) {
  if (state.busy) return
  const tmp = document.createElement('div'); tmp.className = 'log'; // 로그 없이 말풍선만
  await ask({ text, log: tmp, history: [], mode: 'game', context: null, onDone: (full) => { el.gamesay.textContent = full } })
  if (!el.gamesay.textContent && tmp.textContent) el.gamesay.textContent = tmp.textContent.replace(/^[A-Z가-힣]+/, '').trim()
}
// 게임 안 AJ 이벤트(점수·게임오버·클리어)를 받아 반응
window.addEventListener('message', (e) => {
  const d = e.data; if (!d || d.type !== 'aj:event') return
  if (d.name === 'clear') cheer('방금 게임 클리어했어! 한마디')
  else if (d.name === 'over' && typeof d.data?.score === 'number') { clearTimeout(state.gameTimer); state.gameTimer = setTimeout(() => cheer(`게임오버, 점수 ${d.data.score}점. 짧게 한마디`), 800) }
})
el.gameback.addEventListener('click', () => { el.gameframe.src = 'about:blank'; el.gameplay.hidden = true; el.gamepick.hidden = false; clearTimeout(state.gameTimer) })

// ── 학습 탭 ──
async function learn(kind) {
  if (!(await ensurePageAccess())) { addMsg(el.learnlog, 'sys', '페이지 본문을 읽으려면 권한을 허용해 주세요.'); return }
  const context = await pageContext()
  if (!context) { addMsg(el.learnlog, 'sys', '이 탭은 읽을 수 없어요. 일반 웹페이지에서 써 주세요.'); return }
  state.learnHistory = []
  const text = kind === 'quiz' ? '이 페이지 내용으로 퀴즈 3문제 내줘' : '이 페이지 내용을 쉽게 설명해줘'
  addMsg(el.learnlog, 'user', text)
  await ask({ text, log: el.learnlog, history: state.learnHistory, mode: kind, context })
}
async function learnSend(text) {
  text = text.trim(); if (!text) return
  addMsg(el.learnlog, 'user', text); el.learnmsg.value = ''
  const context = await pageContext()
  await ask({ text, log: el.learnlog, history: state.learnHistory, mode: state.learnHistory.length ? 'quiz' : 'explain', context })
}
el.btnExplain.addEventListener('click', () => learn('explain'))
el.btnQuiz.addEventListener('click', () => learn('quiz'))
el.btnReset.addEventListener('click', () => { state.learnHistory = []; el.learnlog.innerHTML = '' })
el.learnform.addEventListener('submit', (e) => { e.preventDefault(); learnSend(el.learnmsg.value) })
el.learnmsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); learnSend(el.learnmsg.value) } })

// ── 헤더 ──
el.save.addEventListener('click', async () => { const k = el.key.value.trim(); if (!k) return; el.save.disabled = true; await connect(k); el.save.disabled = false })
el.key.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.save.click() })
el.gear.addEventListener('click', () => { el.key.value = state.key || ''; show(true) })
el.summon.addEventListener('click', async () => { const tab = await activeTab(); if (!tab?.id) return; try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['companion.js'] }) } catch { addMsg(el.log, 'sys', '이 페이지엔 캐릭터를 소환할 수 없어요.') } })
for (const b of el.tabs.querySelectorAll('.tab')) b.addEventListener('click', () => setTab(b.dataset.tab))
chrome.tabs.onActivated.addListener(() => refreshPage())
chrome.tabs.onUpdated.addListener((_, info) => { if (info.status === 'complete') refreshPage() })

;(async () => {
  const st = await store.get(['ajKey', 'ajHistory', 'ajUseCtx'])
  if (typeof st.ajUseCtx === 'boolean') el.usectx.checked = st.ajUseCtx
  state.history = Array.isArray(st.ajHistory) ? st.ajHistory : []
  for (const m of state.history.slice(-10)) addMsg(el.log, m.role === 'user' ? 'user' : 'aj', m.content)
  if (st.ajKey) { const ok = await connect(st.ajKey); if (ok && !state.history.length && state.me?.greeting) addMsg(el.log, 'aj', state.me.greeting) }
  else show(true)
  refreshPage()
})()
