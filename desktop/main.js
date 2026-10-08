// Vibrex Builder — 데스크톱 게임 빌더 (Electron 메인 프로세스)
// 프롬프트 → vibrexcup 스튜디오 생성 엔진(/api/studio/generate, 개발자 API 키) → 게임 HTML 을 내 컴퓨터 폴더에 파일로 저장 · 미리보기
const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, protocol, net, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

app.setName('Vibrex')   // 메뉴 막대·창 제목에 'Electron' 대신
const API = process.env.VIBREX_API || 'https://vibrexcup.com'
if (process.env.VB_USERDATA) app.setPath('userData', process.env.VB_USERDATA)   // 테스트용 분리 설정
const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json')
const DEFAULT_WS = () => path.join(app.getPath('documents'), 'Vibrex Games')

// ---------- 설정 (API 키는 OS 키체인으로 암호화) ----------
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')) } catch { return {} }
}
function saveSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS()), { recursive: true })
  fs.writeFileSync(SETTINGS(), JSON.stringify(s, null, 2))
}
function getKey() {
  const s = loadSettings()
  if (!s.key) return null
  try { return s.keyEnc ? safeStorage.decryptString(Buffer.from(s.key, 'base64')) : s.key } catch { return null }
}
function setKey(raw) {
  const s = loadSettings()
  if (!raw) { delete s.key; delete s.keyEnc } else if (safeStorage.isEncryptionAvailable()) { s.key = safeStorage.encryptString(raw).toString('base64'); s.keyEnc = true } else { s.key = raw; s.keyEnc = false }
  saveSettings(s)
}
const workspace = () => loadSettings().workspace || DEFAULT_WS()

// ---------- vibrexcup API ----------
async function api(p, opts = {}) {
  const key = getKey()
  if (!key) throw Object.assign(new Error('API 키가 없어요'), { status: 401 })
  const res = await fetch(API + p, { ...opts, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': 'Vibrex/' + app.getVersion(), ...(opts.headers || {}) } })
  if (!res.ok) {
    let msg = ''
    try { const j = await res.clone().json(); msg = j.error || '' } catch { msg = (await res.text().catch(() => '')).slice(0, 200) }
    throw Object.assign(new Error(msg || 'HTTP ' + res.status), { status: res.status })
  }
  return res
}

// ---------- 로컬 파일 (프로젝트 폴더) ----------
const slug = (t) => (t || 'game').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'game'
function projectDir(project) {
  const ws = workspace()
  fs.mkdirSync(ws, { recursive: true })
  // 같은 프로젝트는 game.json 의 id 로 찾는다 (제목이 바뀌어도 같은 폴더)
  for (const d of fs.readdirSync(ws)) {
    try { const j = JSON.parse(fs.readFileSync(path.join(ws, d, 'game.json'), 'utf8')); if (j.id === project.id) return path.join(ws, d) } catch { /* 다른 폴더 */ }
  }
  let name = slug(project.title), dir = path.join(ws, name), n = 2
  while (fs.existsSync(dir)) dir = path.join(ws, `${name} ${n++}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
function writeProjectFiles(data) {
  const { project, versions, current, messages, studioUrl } = data
  const dir = projectDir(project)
  if (current && current.html) {
    fs.mkdirSync(path.join(dir, 'versions'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'versions', `v${current.version}.html`), current.html)
    fs.writeFileSync(path.join(dir, 'index.html'), current.html)
  }
  fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ id: project.id, title: project.title, version: current ? current.version : 0, versions: versions.map((v) => v.version), studioUrl, api: API, savedAt: new Date().toISOString() }, null, 2))
  const log = (messages || []).filter((m) => m.role === 'user').map((m, i) => `${i + 1}. ${m.content.split('\n')[0].slice(0, 300)}`).join('\n')
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${project.title}\n\nVibrex Builder 로 만든 게임입니다.\n\n- 실행: index.html 을 브라우저로 열기\n- 웹 스튜디오에서 이어서 수정·게시: ${studioUrl}\n- 버전 기록: versions/\n\n## 프롬프트 기록\n\n${log || '(아직 없음)'}\n`)
  return dir
}
function listFiles(dir, base = dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.')) continue
    const full = path.join(dir, f.name)
    if (f.isDirectory()) { out.push({ path: path.relative(base, full), dir: true }); listFiles(full, base, out) }
    else out.push({ path: path.relative(base, full), dir: false, size: fs.statSync(full).size })
  }
  return out
}
const inside = (dir, rel) => { const p = path.resolve(dir, rel); if (!p.startsWith(path.resolve(dir) + path.sep)) throw new Error('bad path'); return p }

// ---------- IPC ----------
const dirs = new Map()   // projectId → 폴더
ipcMain.handle('auth:get', async () => {
  if (!getKey()) return { ok: false }
  try { return { ok: true, me: await (await api('/api/v1/build/me')).json(), workspace: workspace() } } catch (e) { return { ok: false, error: e.message, status: e.status } }
})
ipcMain.handle('auth:set', async (_e, raw) => {
  raw = String(raw || '').trim()
  if (!raw.startsWith('vxaj_')) return { ok: false, error: 'vxaj_ 로 시작하는 개발자 API 키를 붙여 넣어 주세요' }
  setKey(raw)
  try { return { ok: true, me: await (await api('/api/v1/build/me')).json(), workspace: workspace() } } catch (e) { setKey(null); return { ok: false, error: e.status === 401 ? '키가 맞지 않거나 폐기됐어요' : e.status === 403 ? '크롬 확장 키는 쓸 수 없어요 — "개발자 API 키"를 발급해 주세요' : e.message } }
})
ipcMain.handle('auth:logout', () => { setKey(null); return true })
ipcMain.handle('me', async () => (await api('/api/v1/build/me')).json())
ipcMain.handle('workspace:choose', async () => {
  const r = await dialog.showOpenDialog({ title: '게임을 저장할 폴더', defaultPath: workspace(), properties: ['openDirectory', 'createDirectory'] })
  if (r.canceled || !r.filePaths[0]) return workspace()
  const s = loadSettings(); s.workspace = r.filePaths[0]; saveSettings(s)
  return s.workspace
})
ipcMain.handle('projects:list', async () => (await (await api('/api/v1/build/projects')).json()).projects)
ipcMain.handle('projects:create', async (_e, title) => (await (await api('/api/v1/build/projects', { method: 'POST', body: JSON.stringify({ title }) })).json()).project)
ipcMain.handle('projects:open', async (_e, id, version) => {
  const data = await (await api(`/api/v1/build/projects/${id}${version ? '?version=' + version : ''}`)).json()
  const dir = writeProjectFiles(data)
  dirs.set(id, dir)
  return { ...data, dir, files: listFiles(dir) }
})
ipcMain.handle('files:list', (_e, id) => { const d = dirs.get(id); return d ? listFiles(d) : [] })
ipcMain.handle('files:read', (_e, id, rel) => fs.readFileSync(inside(dirs.get(id), rel), 'utf8'))
ipcMain.handle('files:write', (_e, id, rel, text) => { fs.writeFileSync(inside(dirs.get(id), rel), text); return true })
ipcMain.handle('open:folder', (_e, id) => shell.openPath(dirs.get(id) || workspace()))
ipcMain.handle('open:browser', (_e, id) => shell.openPath(path.join(dirs.get(id), 'index.html')))
ipcMain.handle('open:external', (_e, url) => { if (/^https:\/\/(vibrexcup\.com|www\.vibrexcup\.com)\//.test(url)) shell.openExternal(url) })

// 생성: 스트림을 그대로 렌더러로 흘려보낸다 (gen:chunk) → 끝나면 서버에 저장된 새 버전을 받아 파일로 쓴다 (gen:done)
const running = new Map()
ipcMain.handle('gen:start', async (e, id, prompt) => {
  const wc = e.sender, ctl = new AbortController()
  running.set(id, ctl)
  try {
    const res = await api('/api/studio/generate', { method: 'POST', body: JSON.stringify({ projectId: id, prompt }), signal: ctl.signal })
    const reader = res.body.getReader(), dec = new TextDecoder()
    let all = ''
    for (;;) { const { value, done } = await reader.read(); if (done) break; const t = dec.decode(value, { stream: true }); all += t; wc.send('gen:chunk', id, t) }
    if (/\[\[GEN_ERROR\]\]/.test(all)) {   // 서버가 만들기에 실패 (크레딧은 자동 환불)
      const why = (all.match(/\[\[GEN_MSG\]\]([\s\S]*?)\[\[\/GEN_MSG\]\]/) || [])[1]
      return { ok: false, error: (why ? why.trim() + ' — ' : '') + '게임을 만들지 못했어요. 프롬코인은 돌려드렸어요. 잠시 후 다시 시도해 주세요' }
    }
    let data = await (await api(`/api/v1/build/projects/${id}`)).json()
    // 서버 시간이 끝나도 생성이 이어지는 경우([[PENDING]]) — 새 버전이 저장될 때까지 기다린다 (최대 15분)
    if (/\[\[PENDING:/.test(all)) {
      const before = data.current ? data.current.version : 0
      for (let i = 0; i < 180 && !ctl.signal.aborted; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        data = await (await api(`/api/v1/build/projects/${id}`)).json()
        if (data.current && data.current.version > before) break
      }
    }
    const dir = writeProjectFiles(data); dirs.set(id, dir)
    return { ok: true, data: { ...data, dir, files: listFiles(dir) } }
  } catch (err) {
    if (ctl.signal.aborted) return { ok: false, error: '멈췄어요' }
    return { ok: false, status: err.status, error: err.status === 402 ? '프롬코인이 부족해요 — vibrexcup.com/credits 에서 충전해 주세요' : err.status === 503 ? '생성 엔진이 잠시 쉬는 중이에요. 잠시 후 다시 시도해 주세요' : err.message }
  } finally { running.delete(id) }
})
ipcMain.handle('gen:stop', (_e, id) => { running.get(id)?.abort(); return true })

// ---------- 창 · 미리보기 프로토콜 ----------
// game://<projectId>/index.html → 그 프로젝트 폴더의 파일 (게임 안 상대 경로 리소스도 그대로)
protocol.registerSchemesAsPrivileged([{ scheme: 'game', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640, backgroundColor: '#0e1016', title: 'Vibrex',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' } })
}

app.whenReady().then(() => {
  protocol.handle('game', (req) => {
    const u = new URL(req.url), dir = dirs.get(u.hostname)
    if (!dir) return new Response('not open', { status: 404 })
    try { return net.fetch(pathToFileURL(inside(dir, decodeURIComponent(u.pathname.slice(1)) || 'index.html')).toString()) } catch { return new Response('bad path', { status: 400 }) }
  })
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Vibrex', submenu: [{ role: 'about', label: 'Vibrex 정보' }, { type: 'separator' }, { role: 'hide', label: 'Vibrex 숨기기' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit', label: 'Vibrex 종료' }] }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
