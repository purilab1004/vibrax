// Vibrexcup AJ — 백그라운드(서비스 워커)
// 페이지에 심은 캐릭터(content script)는 사이트 Origin 으로 요청하면 크롬 키 검사(확장 Origin 전용)에 걸리므로
// 모든 API 호출은 여기서 대신 한다. 키는 페이지 컨텍스트에 절대 노출되지 않는다.
const API = 'https://vibrexcup.com/api/v1/aj'
const EXT_HEADER = { 'X-Vibrex-Ext': `chrome-aj/${chrome.runtime.getManifest().version}` }

const store = {
  get: (keys) => new Promise((r) => chrome.storage.sync.get(keys, r)),
  set: (obj) => new Promise((r) => chrome.storage.sync.set(obj, r)),
  lget: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  lset: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
}

async function apiKey() { const { ajKey } = await store.get(['ajKey']); return ajKey || null }

// 아바타 프레임(기본/깜빡임/말하기)을 data URL 로 — 사이트 CSP(img-src) 와 무관하게 표시하기 위해
async function toDataUrl(url) {
  if (!url) return null
  try { const r = await fetch(url); const b = await r.blob(); return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) }) } catch { return null }
}

async function loadMe(force = false) {
  const key = await apiKey(); if (!key) throw new Error('no_key')
  const cache = await store.lget(['meCache'])
  if (!force && cache.meCache && Date.now() - cache.meCache.at < 60 * 60_000 && cache.meCache.key === key.slice(0, 12)) return cache.meCache.me
  const r = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${key}`, ...EXT_HEADER } })
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`) }
  const me = await r.json()
  const [preview, blink, talk] = await Promise.all([toDataUrl(me.avatar?.preview), toDataUrl(me.avatar?.blink), toDataUrl(me.avatar?.talk)])
  me.frames = { preview, blink: blink || preview, talk: talk || preview }
  await store.lset({ meCache: { at: Date.now(), key: key.slice(0, 12), me } })
  return me
}

// content script 를 현재 탭에 심는다 (activeTab — 사용자가 아이콘/버튼을 눌렀을 때만)
async function summon(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['companion.js'] })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    try {
      if (msg.type === 'me') return sendResponse({ ok: true, me: await loadMe(!!msg.force) })
      if (msg.type === 'summon') { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab?.id) await summon(tab.id); return sendResponse({ ok: true }) }
      if (msg.type === 'alwaysOn') { await setAlwaysOn(!!msg.on); return sendResponse({ ok: true }) }
      if (msg.type === 'getSettings') { const s = await store.get(['ajAlwaysOn', 'ajVoice', 'ajAutoComment', 'ajPos']); return sendResponse({ ok: true, settings: s }) }
      if (msg.type === 'setSettings') { await store.set(msg.settings || {}); return sendResponse({ ok: true }) }
      sendResponse({ ok: false, error: 'unknown' })
    } catch (e) { sendResponse({ ok: false, error: e.message || String(e) }) }
  })()
  return true
})

// 스트리밍 대화 — 포트로 청크 전달
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'aj-chat') return
  port.onMessage.addListener(async (req) => {
    const key = await apiKey(); if (!key) return port.postMessage({ error: '키가 없어요. 확장 아이콘을 눌러 연결하세요.' })
    try {
      const r = await fetch(`${API}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...EXT_HEADER }, body: JSON.stringify({ message: req.message, history: req.history || [], context: req.context || null, stream: true }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); return port.postMessage({ error: j.error === 'daily quota exceeded' ? '오늘 무료 횟수를 다 썼어. 내일 다시!' : (j.error || `HTTP ${r.status}`) }) }
      const reader = r.body.getReader(), dec = new TextDecoder()
      for (;;) { const { value, done } = await reader.read(); if (done) break; port.postMessage({ chunk: dec.decode(value, { stream: true }) }) }
      port.postMessage({ done: true, quota: r.headers.get('X-AJ-Quota') })
    } catch (e) { port.postMessage({ error: e.message || 'failed' }) }
  })
})

// "모든 사이트에서 자동 등장": 사용자가 팝업에서 <all_urls> 권한을 허용하면 content script 를 등록
async function setAlwaysOn(on) {
  await store.set({ ajAlwaysOn: on })
  try { await chrome.scripting.unregisterContentScripts({ ids: ['aj-companion'] }) } catch { /* none */ }
  if (!on) return
  const has = await chrome.permissions.contains({ origins: ['<all_urls>'] })
  if (!has) return
  await chrome.scripting.registerContentScripts([{ id: 'aj-companion', js: ['companion.js'], matches: ['<all_urls>'], runAt: 'document_idle', persistAcrossSessions: true }])
}
chrome.runtime.onInstalled.addListener(async () => { const { ajAlwaysOn } = await store.get(['ajAlwaysOn']); if (ajAlwaysOn) await setAlwaysOn(true) })
chrome.runtime.onStartup.addListener(async () => { const { ajAlwaysOn } = await store.get(['ajAlwaysOn']); if (ajAlwaysOn) await setAlwaysOn(true) })
