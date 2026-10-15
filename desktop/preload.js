// 렌더러에 열어 주는 기능만 (Node 직접 접근 없음)
const { contextBridge, ipcRenderer } = require('electron')
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a)
contextBridge.exposeInMainWorld('vb', {
  auth: { get: call('auth:get'), set: call('auth:set'), logout: call('auth:logout') },
  me: call('me'),
  chooseWorkspace: call('workspace:choose'),
  projects: { list: call('projects:list'), create: call('projects:create'), open: call('projects:open') },
  files: { list: call('files:list'), read: call('files:read'), write: call('files:write') },
  open: { folder: call('open:folder'), browser: call('open:browser'), external: call('open:external') },
  gen: { start: call('gen:start'), stop: call('gen:stop'), onChunk: (fn) => ipcRenderer.on('gen:chunk', (_e, id, t) => fn(id, t)) },
  godot: { status: call('godot:status'), install: call('godot:install'), run: call('godot:run'), onProgress: (fn) => ipcRenderer.on('godot:progress', (_e, p) => fn(p)) },
  platform: process.platform,
})
