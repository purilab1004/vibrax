// Vibrexcup AJ 크롬 확장 — 팝업. 키는 chrome.storage.sync 에만 저장되고 vibrexcup.com 외 어디에도 전송되지 않는다.
const API = 'https://vibrexcup.com/api/v1/aj'
const EXT_HEADER = { 'X-Vibrex-Ext': `chrome-aj/${chrome.runtime.getManifest().version}` }
const $ = (id) => document.getElementById(id)
const el = { setup: $('setup'), chat: $('chat'), key: $('key'), save: $('save'), setupErr: $('setup-err'), gear: $('gear'), log: $('log'), form: $('form'), msg: $('msg'), send: $('send'), usectx: $('usectx'), quota: $('quota'), name: $('name'), sub: $('sub'), avatar: $('avatar'), summon: $('summon'), optAlways: $('opt-always'), optVoice: $('opt-voice'), optAuto: $('opt-auto') }
let state = { key: null, me: null, history: [], busy: false }

async function loadStorage() { return new Promise((r) => chrome.storage.sync.get(['ajKey', 'ajHistory', 'ajUseCtx', 'ajAlwaysOn', 'ajVoice', 'ajAutoComment'], r)) }
async function saveStorage(patch) { return new Promise((r) => chrome.storage.sync.set(patch, r)) }

function show(setup) { el.setup.hidden = !setup; el.chat.hidden = setup }
function addMsg(role, text) {
  const d = document.createElement('div'); d.className = `m ${role}`
  if (role === 'aj') { const t = document.createElement('span'); t.className = 'tag'; t.textContent = (state.me?.name || 'AJ').toUpperCase(); d.appendChild(t) }
  const s = document.createElement('span'); s.textContent = text; d.appendChild(s)
  el.log.appendChild(d); el.log.scrollTop = el.log.scrollHeight; return s
}

async function fetchMe() {
  const r = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${state.key}`, ...EXT_HEADER } })
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`) }
  return r.json()
}

function renderMe() {
  const m = state.me; if (!m) return
  el.name.textContent = m.name
  el.sub.textContent = m.persona ? m.persona : (m.owner ? `${m.owner}의 AJ` : 'vibrexcup.com')
  if (m.avatar?.preview) { el.avatar.src = m.avatar.preview; el.avatar.hidden = false } else el.avatar.hidden = true
  el.quota.textContent = `오늘 ${m.quota?.today ?? 0}/${m.quota?.daily ?? '-'}회 · 무료`
}

// 현재 탭의 제목·URL·본문 일부를 컨텍스트로 (activeTab 권한, 사용자가 팝업을 열었을 때만)
async function pageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !/^https?:/.test(tab.url || '')) return null
    let text = ''
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 1500) })
      text = res?.result || ''
    } catch { /* 권한 없는 페이지(스토어 등) */ }
    return { title: tab.title || '', url: tab.url || '', text }
  } catch { return null }
}

async function send(text) {
  if (state.busy || !text.trim()) return
  state.busy = true; el.send.disabled = true
  addMsg('user', text); el.msg.value = ''; autosize()
  const target = addMsg('aj', ''); const cursor = document.createElement('span'); cursor.className = 'typing'; target.parentElement.appendChild(cursor)
  const context = el.usectx.checked ? await pageContext() : null
  let full = ''
  try {
    const r = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.key}`, 'Content-Type': 'application/json', ...EXT_HEADER },
      body: JSON.stringify({ message: text, history: state.history.slice(-10), context, stream: true }),
    })
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error === 'daily quota exceeded' ? '오늘 무료 횟수를 다 썼어요. 내일 다시!' : (j.error || `HTTP ${r.status}`)) }
    const reader = r.body.getReader(); const dec = new TextDecoder()
    for (;;) { const { value, done } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); target.textContent = full; el.log.scrollTop = el.log.scrollHeight }
    const q = r.headers.get('X-AJ-Quota'); if (q) el.quota.textContent = `오늘 ${q}회 · 무료`
    state.history.push({ role: 'user', content: text }, { role: 'assistant', content: full })
    state.history = state.history.slice(-20)
    await saveStorage({ ajHistory: state.history })
  } catch (e) {
    target.textContent = full || `⚠ ${e.message}`
  } finally { cursor.remove(); state.busy = false; el.send.disabled = false; el.msg.focus() }
}

function autosize() { el.msg.style.height = 'auto'; el.msg.style.height = Math.min(96, el.msg.scrollHeight) + 'px' }

async function connect(key) {
  state.key = key
  try { state.me = await fetchMe(); await saveStorage({ ajKey: key }); renderMe(); show(false); return true }
  catch (e) { el.setupErr.textContent = e.message.includes('extension') ? '이 키는 확장 전용 키가 아니에요. 내 정보 → AJ API에서 “크롬 확장 키”를 발급하세요.' : `연결 실패: ${e.message}`; el.setupErr.hidden = false; return false }
}

el.save.addEventListener('click', async () => { const k = el.key.value.trim(); if (!k) return; el.save.disabled = true; await connect(k); el.save.disabled = false })
el.key.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.save.click() })
el.gear.addEventListener('click', () => { el.key.value = state.key || ''; show(true) })
el.form.addEventListener('submit', (e) => { e.preventDefault(); send(el.msg.value) })
el.msg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(el.msg.value) } })
el.msg.addEventListener('input', autosize)
el.usectx.addEventListener('change', () => saveStorage({ ajUseCtx: el.usectx.checked }))
// ── 페이지 위 캐릭터 소환 + 설정 ──
const bg = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r))
el.summon.addEventListener('click', async () => { el.summon.disabled = true; const r = await bg({ type: 'summon' }); el.summon.disabled = false; if (r?.ok) window.close(); else el.summon.textContent = '이 페이지엔 소환할 수 없어요 (chrome:// 등)' })
el.optAlways.addEventListener('change', async () => {
  if (el.optAlways.checked) {
    // 권한 요청은 사용자 클릭 컨텍스트(팝업)에서만 가능
    const ok = await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false)
    if (!ok) { el.optAlways.checked = false; return }
  }
  await bg({ type: 'alwaysOn', on: el.optAlways.checked })
})
el.optVoice.addEventListener('change', () => saveStorage({ ajVoice: el.optVoice.checked }))
el.optAuto.addEventListener('change', () => saveStorage({ ajAutoComment: el.optAuto.checked }))

;(async () => {
  const st = await loadStorage()
  if (typeof st.ajUseCtx === 'boolean') el.usectx.checked = st.ajUseCtx
  el.optAlways.checked = !!st.ajAlwaysOn; el.optVoice.checked = !!st.ajVoice; el.optAuto.checked = !!st.ajAutoComment
  state.history = Array.isArray(st.ajHistory) ? st.ajHistory : []
  for (const m of state.history.slice(-10)) addMsg(m.role === 'user' ? 'user' : 'aj', m.content)
  if (st.ajKey) { const ok = await connect(st.ajKey); if (ok && state.history.length === 0 && state.me?.greeting) addMsg('aj', state.me.greeting) }
  else show(true)
})()
