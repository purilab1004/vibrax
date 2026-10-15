// Vibrex Builder 화면 — 프로젝트 · 미리보기/코드 · 파일 · AI 채팅
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
if (vb.platform === 'darwin') document.body.classList.add('mac')

const st = { me: null, projects: [], cur: null, data: null, file: 'index.html', busy: false, stream: '' }
const IDEAS = ['우주선이 운석을 피하는 슈팅 게임', '벽돌깨기 · 아이템과 보스', '3D 레이싱 게임', '좀비 서바이벌 탑다운', '메이플 같은 횡스크롤 RPG', '같은 색 3개 맞추기 퍼즐']

// ---------- 공통 ----------
document.addEventListener('click', (e) => { const a = e.target.closest('[data-ext]'); if (a) { e.preventDefault(); vb.open.external(a.dataset.ext) } })
function addMsg(kind, html) { const d = document.createElement('div'); d.className = 'msg ' + kind; d.innerHTML = html; $('msgs').appendChild(d); $('msgs').scrollTop = 1e9; return d }
function setBal() {
  if (!st.me) return
  $('bal').innerHTML = `🪙 <b>${st.me.balance.toLocaleString()}</b> · 1회 ${st.me.generationCost}`
  $('costHint').textContent = `생성 1회 ${st.me.generationCost} 프롬코인`
}
async function refreshMe() { try { st.me = await vb.me(); setBal() } catch { /* 무시 */ } }

// ---------- 로그인 ----------
async function boot() {
  const r = await vb.auth.get()
  if (!r.ok) { $('login').classList.remove('hidden'); if (r.error && r.status !== 401) $('keyErr').textContent = '연결 실패: ' + r.error; return }
  start(r)
}
$('keyBtn').onclick = async () => {
  $('keyErr').textContent = ''; $('keyBtn').disabled = true
  const r = await vb.auth.set($('keyIn').value)
  $('keyBtn').disabled = false
  if (!r.ok) { $('keyErr').textContent = r.error; return }
  $('keyIn').value = ''; start(r)
}
$('keyIn').onkeydown = (e) => { if (e.key === 'Enter') $('keyBtn').click() }
$('logoutBtn').onclick = async () => { await vb.auth.logout(); location.reload() }
$('wsBtn').onclick = async () => { const w = await vb.chooseWorkspace(); $('wsName').textContent = w.split(/[\\/]/).pop(); if (st.cur) openProject(st.cur) }

async function start(r) {
  $('login').classList.add('hidden')
  st.me = r.me; setBal()
  $('wsName').textContent = r.workspace.split(/[\\/]/).pop()
  document.querySelector('.ideas').innerHTML = IDEAS.map((t) => `<button>${esc(t)}</button>`).join('')
  document.querySelectorAll('.ideas button').forEach((b) => (b.onclick = () => { $('prompt').value = b.textContent; $('prompt').focus() }))
  await loadProjects()
  if (st.projects[0]) openProject(st.projects[0].id)
  else showEmpty(true)
}

// ---------- 프로젝트 ----------
async function loadProjects() {
  st.projects = await vb.projects.list()
  $('projects').innerHTML = st.projects.map((p) => `<li data-id="${p.id}" class="${p.id === st.cur ? 'on' : ''}">${esc(p.title)}<small>${new Date(p.created_at).toLocaleDateString()}</small></li>`).join('') || '<li class="dir">아직 없어요</li>'
  document.querySelectorAll('#projects li[data-id]').forEach((li) => (li.onclick = () => { if (!st.busy) openProject(li.dataset.id) }))
}
$('newBtn').onclick = async () => {
  if (st.busy) return
  const p = await vb.projects.create('새 게임')
  await loadProjects(); await openProject(p.id)
  $('prompt').focus()
}
async function openProject(id, version) {
  st.cur = id
  document.querySelectorAll('#projects li').forEach((li) => li.classList.toggle('on', li.dataset.id === id))
  try { st.data = await vb.projects.open(id, version) } catch (e) { addMsg('err', '프로젝트를 열지 못했어요: ' + esc(e.message)); return }
  const d = st.data
  $('projTitle').textContent = d.project.title
  $('verSel').innerHTML = d.versions.slice().reverse().map((v) => `<option value="${v.version}" ${d.current && v.version === d.current.version ? 'selected' : ''}>v${v.version}</option>`).join('')
  $('verSel').classList.toggle('hidden', !d.versions.length)
  renderFiles(d.files)
  $('msgs').innerHTML = ''
  for (const m of d.messages) addMsg(m.role === 'user' ? 'user' : 'ai', esc(m.role === 'user' ? m.content : cleanReply(m.content)))
  if (!d.messages.length) addMsg('sys', '만들고 싶은 게임을 적어 보세요. 생성이 끝나면 이 폴더에 파일로 저장돼요.<br>' + esc(d.dir))
  showEmpty(!d.current)
  if (d.current) loadPreview()
  showGodot(!!d.godot)
  showUnity(!!d.unity)
  st.file = 'index.html'; if ($('codeWrap').classList.contains('on')) loadCode()
}
$('verSel').onchange = () => openProject(st.cur, Number($('verSel').value))

function renderFiles(files) {
  $('files').innerHTML = files.map((f) => {
    const depth = f.path.split(/[\\/]/).length - 1, name = f.path.split(/[\\/]/).pop()
    return `<li class="${f.dir ? 'dir' : ''} ${f.path === st.file ? 'on' : ''}" data-path="${esc(f.path)}" style="padding-left:${8 + depth * 14}px">${f.dir ? '▾ ' : ''}${esc(name)}${f.dir ? '' : `<span class="hint"> ${f.size > 1024 ? Math.round(f.size / 1024) + 'KB' : f.size + 'B'}</span>`}</li>`
  }).join('')
  document.querySelectorAll('#files li:not(.dir)').forEach((li) => (li.onclick = () => { st.file = li.dataset.path; tab('code'); loadCode(); renderFiles(files) }))
}
$('folderBtn').onclick = () => vb.open.folder(st.cur)
$('browserBtn').onclick = () => st.cur && vb.open.browser(st.cur)
// ---------- Godot 프로젝트: 실행 · 편집기 (Godot 가 없으면 자동 설치) ----------
const mb = (n) => (n / 1048576).toFixed(0) + 'MB'
vb.godot.onProgress((p) => {
  const el = $('godotStat'); el.classList.remove('hidden')
  el.textContent = p.phase === 'download' ? `Godot ${p.version} 내려받는 중 ${p.total ? Math.round(p.got / p.total * 100) + '% · ' : ''}${mb(p.got)}${p.total ? ' / ' + mb(p.total) : ''}` : p.phase === 'extract' ? `Godot ${p.version} 설치 중…` : `Godot ${p.version} 설치 완료`
})
async function godotStatus() {
  const g = await vb.godot.status()
  $('godotStat').classList.remove('hidden')
  $('godotStat').textContent = g.installed ? `Godot ${g.version === 'system' ? '(설치됨)' : g.version} 준비됨` : 'Godot 없음 — 실행하면 자동 설치 (약 80~160MB)'
}
async function runGodot(editor) {
  if (!st.cur) return
  $('godotRun').disabled = $('godotEdit').disabled = true
  const r = await vb.godot.run(st.cur, editor)
  $('godotRun').disabled = $('godotEdit').disabled = false
  if (!r.ok) { addMsg('err', esc(r.error)); return }
  $('godotStat').textContent = `Godot ${r.version} 에서 ${editor ? '편집기를 열었어요' : '실행 중'}`
}
$('godotRun').onclick = () => runGodot(false)
$('godotEdit').onclick = () => runGodot(true)
// ---------- Unity 프로젝트 ----------
async function unityStatusText() {
  const u = await vb.unity.status()
  $('godotStat').classList.remove('hidden')
  $('godotStat').textContent = u.editor ? `Unity ${u.editor.version} 준비됨` : u.hub ? 'Unity Hub 는 있어요 — 에디터(Unity 6 LTS) 설치 필요' : 'Unity 없음 — Unity Hub 설치·로그인 필요'
}
$('unityOpen').onclick = async () => {
  if (!st.cur) return
  const r = await vb.unity.open(st.cur)
  if (!r.ok) { addMsg('err', esc(r.error)); return }
  if (r.action === 'editor') addMsg('sys', `Unity ${esc(r.version)} 로 열고 있어요. 처음 열 때는 가져오기에 몇 분 걸려요 — 다 열리면 ▶ Play 를 누르세요.`)
  else if (r.action === 'hub') addMsg('sys', 'Unity Hub 를 열었어요. Installs → Install Editor 에서 <b>Unity 6 LTS</b> 를 설치한 뒤 다시 ▶ Unity 로 열기 를 누르세요.')
  else addMsg('sys', 'Unity 다운로드 페이지를 열었어요. Unity Hub 를 설치하고 로그인 → Unity 6 LTS 에디터를 설치한 뒤 다시 ▶ Unity 로 열기 를 누르세요.')
  unityStatusText()
}
function showUnity(on) { $('unityOpen').classList.toggle('hidden', !on); if (on) { $('godotStat').classList.remove('hidden'); unityStatusText() } }
function showGodot(on) { for (const id of ['godotRun', 'godotEdit', 'godotStat']) $(id).classList.toggle('hidden', !on); if (on) godotStatus() }
$('publishBtn').onclick = () => st.data && vb.open.external(st.data.studioUrl)

// ---------- 미리보기 · 코드 ----------
function showEmpty(on) { $('empty').style.display = on ? 'flex' : 'none' }
function loadPreview() { $('preview').src = `game://${st.cur}/index.html?t=${Date.now()}` }
$('reloadBtn').onclick = loadPreview
function tab(name) {
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name))
  $('previewWrap').classList.toggle('on', name === 'preview'); $('codeWrap').classList.toggle('on', name === 'code')
}
document.querySelectorAll('.tabs [data-tab]').forEach((b) => (b.onclick = () => { tab(b.dataset.tab); if (b.dataset.tab === 'code') loadCode() }))
async function loadCode() {
  if (!st.cur) return
  $('codeFile').textContent = st.file
  try { $('code').value = await vb.files.read(st.cur, st.file) } catch { $('code').value = '' }
}
async function saveCode() {
  if (!st.cur) return
  await vb.files.write(st.cur, st.file, $('code').value)
  $('saveBtn').textContent = '저장됨 ✓'; setTimeout(() => ($('saveBtn').textContent = '저장 (⌘S)'), 1200)
  if (st.file === 'index.html') loadPreview()
}
$('saveBtn').onclick = saveCode
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && $('codeWrap').classList.contains('on')) { e.preventDefault(); saveCode() } })
$('code').addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end') } })

// ---------- AI 생성 ----------
// 스트림 = 설명 글 → <game>코드</game> (또는 패치) + [[마커]]. 설명만 말풍선에, 코드는 진행 화면에
function cleanReply(t) {
  return t.replace(/<game>[\s\S]*?(<\/game>|$)/g, '').replace(/<<<<<<<[\s\S]*?>>>>>>>[^\n]*\n?/g, '').replace(/\[\[(GEN_MSG)\]\]([\s\S]*?)\[\[\/GEN_MSG\]\]/g, '$2').replace(/\[\[[^\]]*\]\]/g, '').replace(/```[\s\S]*?```/g, '').trim()
}
let live = null
vb.gen.onChunk((id, t) => {
  if (id !== st.cur || !live) return
  st.stream += t
  const reply = cleanReply(st.stream)
  live.firstChild.textContent = reply || '생각하는 중…'
  const gi = st.stream.indexOf('<game>'), code = gi >= 0 ? st.stream.slice(gi + 6) : (/<<<<<<<|SEARCH/.test(st.stream) ? st.stream : '')
  if (code) {
    $('buildStat').textContent = `코드 ${code.length.toLocaleString()}자 작성 중`
    $('codeTail').textContent = code.slice(-1400)
  }
  $('msgs').scrollTop = 1e9
})
$('ask').onsubmit = async (e) => {
  e.preventDefault()
  const prompt = $('prompt').value.trim()
  if (!prompt || st.busy) return
  if (!st.cur) { const p = await vb.projects.create(prompt.slice(0, 30)); await loadProjects(); await openProject(p.id) }
  st.busy = true; st.stream = ''
  $('prompt').value = ''; $('sendBtn').disabled = true; $('stopBtn').classList.remove('hidden')
  document.querySelectorAll('#msgs .sys').forEach((d) => d.remove())
  addMsg('user', esc(prompt))
  live = addMsg('ai', '<span>생각하는 중…</span>')
  tab('preview'); $('building').classList.add('on'); $('buildStat').textContent = ''; $('codeTail').textContent = ''
  const prev = st.data && st.data.current ? st.data.current.version : 0
  const r = await vb.gen.start(st.cur, prompt)
  $('building').classList.remove('on'); $('sendBtn').disabled = false; $('stopBtn').classList.add('hidden'); st.busy = false
  if (!r.ok) { live.remove(); addMsg('err', esc(r.error)); live = null; refreshMe(); return }
  const d = r.data, nv = d.current ? d.current.version : 0
  live = null
  st.data = d
  await openProject(st.cur)
  if (nv > prev) addMsg('sys', `✓ v${nv} 저장 — index.html · versions/v${nv}.html`)
  await loadProjects(); refreshMe()
}
$('prompt').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('ask').requestSubmit() } }
$('stopBtn').onclick = () => vb.gen.stop(st.cur)

boot()
