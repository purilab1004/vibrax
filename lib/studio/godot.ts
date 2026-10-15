// 개발 타입 Godot — AI 가 Godot 4 프로젝트(텍스트 파일들)를 만든다. 서버·워커·데스크톱 빌더 공용 (순수 함수, 의존성 없음)
// 저장: 프로젝트 파일들을 '프로젝트 뷰어' HTML 안에 JSON 으로 넣어 studio_versions.html 에 둔다 →
//       버전·대화·미리보기 흐름은 그대로 쓰고, 미리보기 화면에서 파일을 보고 .zip 으로 받는다. 데스크톱 빌더(Vibrex)는 이 JSON 을 꺼내 폴더로 쓰고 Godot 로 실행한다.

import { extractPatches, applyPatches } from './patch'

export const ENGINE_JOB_MARK = '[[VIBREX_ENGINE_PROJECT]]'   // 워커: 이 표시가 있는 시스템 프롬프트는 HTML 실행 테스트를 건너뛴다
export const GODOT_JSON_ID = 'vibrex-godot'
export const UNITY_JSON_ID = 'vibrex-unity'
export const GODOT_PCK_ID = 'vibrex-godot-pck'          // 웹 빌드(게임 데이터 .pck, base64) — 있으면 미리보기에서 바로 플레이
export const GODOT_WEB_ENGINE = '4.7.2'                  // public/godot/<버전>/ 에 올려 둔 공용 웹 엔진 (스레드 없는 빌드)
export const hasGodotWeb = (html: string | null | undefined) => !!html && html.includes(`id="${GODOT_PCK_ID}"`)
export type EngineKind = 'godot' | 'unity'
export interface GodotFile { path: string; content: string }
export interface GodotProject { engine: EngineKind; version: number; dimension: '2d' | '3d'; title: string; files: GodotFile[] }
const JSON_ID: Record<EngineKind, string> = { godot: GODOT_JSON_ID, unity: UNITY_JSON_ID }

const OK_EXT = /\.(godot|gd|tscn|tres|cfg|gdshader|json|md|txt|import|cs|asmdef|shader|asset)$/i
const MAX_FILES = 40, MAX_BYTES = 400_000

export function buildGodotSystemPrompt(): string {
  return `${ENGINE_JOB_MARK}
너는 Godot 엔진 게임 개발자다. 사용자의 설명(과 [개발 설정])으로 **Godot 4 (4.3 이상) 프로젝트**를 만든다. 결과는 사용자가 Godot 편집기에서 그대로 열어 실행(F5)한다.

[출력 형식 — 반드시 지킨다]
1) 먼저 한국어로 무엇을 만들었는지 1~3문장 설명 (첫 문장에 「게임 제목」).
2) 그다음 <game> 로 시작해 프로젝트의 **모든 파일**을 아래 형식으로 하나씩 넣고 </game> 로 닫는다. 코드펜스(\`\`\`) 금지, 파일 밖에 다른 글 금지.
<game>
<file path="project.godot">…파일 전체 내용…</file>
<file path="main.tscn">…</file>
<file path="main.gd">…</file>
</game>
3) 수정 요청이면 **바뀌는 파일만** 출력한다(파일 전체 내용, 또는 그 <file> 안에 SEARCH/REPLACE 블록). 출력하지 않은 파일은 그대로 유지된다.

[프로젝트 규칙 — 외부 에셋 없이 바로 실행되게]
- 파일: project.godot · main.tscn · main.gd 는 필수. 필요하면 player.gd 같은 스크립트를 더 만들되 3~6개 파일로 간결하게. 이미지·사운드·폰트 파일은 만들지 않는다(텍스트 파일만).
- project.godot 은 정확히 이 틀을 쓴다(값만 바꾼다):
; Engine configuration file.
config_version=5

[application]
config/name="게임 제목"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "GL Compatibility")

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
- main.tscn 은 정확히 이 틀(2D 는 Node2D, 3D 는 Node3D):
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node2D"]
script = ExtResource("1")
- **모든 노드는 main.gd 의 _ready() 에서 코드로 만든다**(.tscn 에 노드를 길게 쓰지 않는다). 그래픽은 _draw()·Polygon2D·ColorRect·Line2D·GPUParticles2D/CPUParticles2D, 3D 는 MeshInstance3D(BoxMesh·SphereMesh·CapsuleMesh·CylinderMesh·PlaneMesh)+StandardMaterial3D, Camera3D, DirectionalLight3D, WorldEnvironment(배경색·안개·글로우)로 만든다. 그래도 단조롭지 않게 색·조명·파티클·흔들림·트윈으로 손맛을 낸다.
- 입력 액션도 _ready() 에서 코드로 만든다(InputMap.add_action + InputEventKey.physical_keycode). 표준 키: 이동 ←→↑↓, jump=Space, fire=A, guard=S, item=D, restart=R. 마우스 클릭/터치는 보조로 허용.
- GDScript 2.0 문법만(Godot 3 문법 금지): @onready, @export, func _process(delta: float) -> void, Vector2/Vector3, CharacterBody2D/3D 는 velocity 속성 + move_and_slide() 인자 없이, signal 은 .connect(func) 형태, yield 대신 await, tween 은 create_tween().
- 화면 안의 글자(UI 텍스트)는 **짧은 영어**로 쓴다(웹 내보내기·모든 기기에서 한글 글꼴이 깨지지 않게). 설명 문장(출력 1번)만 한국어.
- 게임 흐름: 타이틀(제목·조작법·"Press Space") → 플레이(점수·목숨/체력 HUD) → 게임오버/클리어(점수, "R: Restart"). 난이도는 시간에 따라 오른다.
- 실행 즉시 에러 없이 돌아가야 한다: 존재하지 않는 노드 경로·리소스를 참조하지 말고, 타입이 맞는지 확인하고, 모든 함수가 실제로 정의돼 있게 한다.`
}

/** 수정 결과 합치기 — 출력된 파일은 전체 교체, 파일 안의 SEARCH/REPLACE 는 이전 내용에 적용, 출력 안 된 파일은 그대로.
 *  파일 밖의 SEARCH/REPLACE(<patch>) 도 찾는 문장이 들어 있는 이전 파일에 적용한다. failed = 적용하지 못한 블록 수 */
export function mergeEngineFiles(prev: GodotFile[], raw: string): { files: GodotFile[]; failed: number } {
  const gi = raw.indexOf('<game>')
  const body = gi >= 0 ? raw.slice(gi) : raw
  const out = new Map(prev.map((f) => [f.path, f.content]))
  let failed = 0
  for (const f of parseGodotFiles(body)) {
    const ex = extractPatches(f.content)
    if (ex.blocks.length) {
      const base = out.get(f.path)
      if (base == null) { failed += ex.blocks.length; continue }
      const r = applyPatches(base, ex.blocks); failed += r.failed.length; out.set(f.path, r.html)
    } else out.set(f.path, f.content)
  }
  // 파일 태그 밖의 패치
  const outside = body.replace(/<file\s+path="[^"]*"\s*>[\s\S]*?<\/file>/g, '')
  for (const b of extractPatches(outside).blocks) {
    const hit = [...out.entries()].find(([, c]) => c.includes(b.search.replace(/\r\n/g, '\n')))
    if (!hit) { failed++; continue }
    const r = applyPatches(hit[1], [b]); failed += r.failed.length; out.set(hit[0], r.html)
  }
  return { files: [...out.entries()].map(([path, content]) => ({ path, content })), failed }
}

/** 모델 출력(<game> 안의 <file> 블록들) → 파일 목록. 안전한 상대 경로·텍스트 파일만 */
export function parseGodotFiles(text: string): GodotFile[] {
  const out: GodotFile[] = []
  let total = 0
  const re = /<file\s+path="([^"]{1,120})"\s*>([\s\S]*?)<\/file>/g
  for (let m; (m = re.exec(text)) && out.length < MAX_FILES;) {
    const path = m[1].trim().replace(/^res:\/\//, '').replace(/^\.?\//, '')
    if (!path || path.includes('..') || path.startsWith('/') || !OK_EXT.test(path)) continue
    let content = m[2].replace(/^\n/, '')
    content = content.replace(/^```[a-z]*\n([\s\S]*?)\n```\s*$/i, '$1')   // 지시를 어기고 코드펜스를 쓴 경우
    total += content.length
    if (total > MAX_BYTES) break
    const i = out.findIndex((f) => f.path === path)
    if (i >= 0) out[i] = { path, content }; else out.push({ path, content })
  }
  return out
}

export const godotTitle = (files: GodotFile[]) => files.find((f) => f.path === 'project.godot')?.content.match(/config\/name="([^"]{1,60})"/)?.[1] ?? 'Godot Game'
export const godotDimension = (files: GodotFile[]): '2d' | '3d' => (/type="Node3D"/.test(files.find((f) => f.path.endsWith('.tscn'))?.content ?? '') || files.some((f) => /\b(Node3D|Camera3D|MeshInstance3D)\b/.test(f.content)) ? '3d' : '2d')

/** 버전 HTML 이 Godot 프로젝트 뷰어인지, 맞으면 프로젝트를 꺼낸다 */
export function extractGodotProject(html: string | null | undefined): GodotProject | null {
  if (!html) return null
  for (const id of [GODOT_JSON_ID, UNITY_JSON_ID]) {
    if (!html.includes(id)) continue
    const m = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))
    if (!m) continue
    try { const p = JSON.parse(m[1]) as GodotProject; if (p && (p.engine === 'godot' || p.engine === 'unity') && Array.isArray(p.files)) return p } catch { /* 다음 */ }
  }
  return null
}
export const extractEngineProject = extractGodotProject

/** 수정 요청 때 모델에 보여 줄 현재 프로젝트 */
export const godotFilesAsText = (files: GodotFile[]) => files.map((f) => `<file path="${f.path}">\n${f.content}</file>`).join('\n')

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** 모델 원문 출력 → 저장할 뷰어 HTML (파일이 없으면 null) */
export function godotVersionHtml(raw: string, prev?: GodotFile[] | null): string | null {
  const gi = raw.indexOf('<game>')
  const files = prev && prev.length ? mergeEngineFiles(prev, raw).files : parseGodotFiles(gi >= 0 ? raw.slice(gi) : raw)
  if (!files.some((f) => f.path === 'project.godot')) return null
  return godotViewerHtml({ engine: 'godot', version: 4, dimension: godotDimension(files), title: godotTitle(files), files })
}
/** 엔진별 모델 출력 → 뷰어 HTML (Unity 는 lib/studio/unity.ts 가 고정 파일을 더한다) */
export function engineVersionHtml(engine: EngineKind, raw: string, finish?: (files: GodotFile[], raw: string) => GodotProject | null, prev?: GodotFile[] | null): string | null {
  if (engine === 'godot') return godotVersionHtml(raw, prev)
  const gi = raw.indexOf('<game>')
  const files = prev && prev.length ? mergeEngineFiles(prev, raw).files : parseGodotFiles(gi >= 0 ? raw.slice(gi) : raw)
  const p = finish ? finish(files, raw) : null
  return p ? godotViewerHtml(p) : null
}

/** 프로젝트 뷰어 — 파일 목록·코드 보기·.zip 받기·실행 방법 (스튜디오 미리보기 칸에 뜬다) */
const VIEW: Record<EngineKind, { name: string; color: string; letter: string; run: string }> = {
  godot: { name: 'Godot 4', color: '#478cbf', letter: 'G', run: '<b>데스크톱 빌더 Vibrex</b> 에서 열면 Godot 를 자동 설치하고 바로 실행돼요 · 또는 .zip 을 풀어 Godot 4 에서 project.godot 열기' },
  unity: { name: 'Unity', color: '#222c37', letter: 'U', run: '<b>데스크톱 빌더 Vibrex</b> 에서 열면 설치된 Unity 로 바로 열려요 · 또는 .zip 을 풀어 Unity Hub → Add project → 열고 ▶ Play' },
}
export function godotViewerHtml(p: GodotProject, web?: { pck: string; engine?: string } | null): string {
  const V = VIEW[p.engine], JID = JSON_ID[p.engine]
  if (web && p.engine === 'godot') return godotPlayerHtml(p, web.pck, web.engine ?? GODOT_WEB_ENGINE)
  const json = JSON.stringify(p).replace(/</g, '\\u003c')
  const lines = p.files.reduce((n, f) => n + f.content.split('\n').length, 0)
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#16181f;color:#e7e9f0;font:14px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.top{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #2a2e3c;background:#1c1f29}
.logo{width:34px;height:34px;border-radius:9px;background:${V.color};border:1px solid #3a4155;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff}
.top h1{margin:0;font-size:16px}.top small{display:block;color:#8b91a5;font-size:11.5px;font-weight:500}
.btn{margin-left:auto;border:0;border-radius:10px;padding:9px 14px;background:${p.engine === 'unity' ? '#4c7cf0' : V.color};color:#fff;font-weight:800;cursor:pointer;font-size:13px}
.btn:hover{filter:brightness(1.1)}
.wrap{display:grid;grid-template-columns:200px 1fr;height:calc(100% - 63px - 46px)}
.files{border-right:1px solid #2a2e3c;overflow:auto;padding:8px}.files div{padding:6px 8px;border-radius:6px;cursor:pointer;font:12.5px Menlo,Consolas,monospace;color:#c7cbd8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.files div:hover{background:#232735}.files div.on{background:#2b3a52;color:#fff}
pre{margin:0;overflow:auto;padding:14px 16px;font:12.5px/1.6 Menlo,Consolas,monospace;color:#d6dbf5;background:#12141a;height:100%;tab-size:4}
.foot{height:46px;display:flex;align-items:center;gap:10px;padding:0 16px;border-top:1px solid #2a2e3c;background:#1c1f29;color:#8b91a5;font-size:12px}
.foot b{color:#e7e9f0}
@media(max-width:600px){.wrap{grid-template-columns:1fr;grid-template-rows:120px 1fr}.files{border-right:0;border-bottom:1px solid #2a2e3c}}
</style></head><body>
<div class="top"><div class="logo">${V.letter}</div><div><h1>${esc(p.title)}</h1><small>${V.name} · ${p.dimension.toUpperCase()} · 파일 ${p.files.length}개 · ${lines.toLocaleString()}줄</small></div><button class="btn" id="dl">⬇ 프로젝트 .zip</button></div>
<div class="wrap"><div class="files" id="files"></div><pre id="code"></pre></div>
<div class="foot">▶ 실행: ${V.run}</div>
<script type="application/json" id="${JID}">${json}</script>
<script>
(function(){
var P=JSON.parse(document.getElementById('${JID}').textContent),fl=document.getElementById('files'),code=document.getElementById('code');
function show(i){[].forEach.call(fl.children,function(d,j){d.className=j===i?'on':''});code.textContent=P.files[i].content}
P.files.forEach(function(f,i){var d=document.createElement('div'),parts=f.path.split('/'),dir=parts.slice(0,-1).join('/');d.title=f.path;d.innerHTML=(/\\.(gd|cs)$/.test(f.path)?'📜 ':/\\.(tscn|unity)$/.test(f.path)?'🎬 ':'⚙ ')+parts[parts.length-1].replace(/[&<>]/g,'')+(dir?' <span style="color:#6b7186;font-size:10.5px">'+dir.replace(/[&<>]/g,'')+'</span>':'');d.onclick=function(){show(i)};fl.appendChild(d)});
var mi=P.files.findIndex(function(f){return f.path==='main.gd'||/Assets\\/Scripts\\/Game\\.cs$/.test(f.path)});show(mi>=0?mi:0);
// 압축 없는(store) zip — 외부 라이브러리 없이
var T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0}
function crc(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=T[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zip(files){var enc=new TextEncoder(),parts=[],cen=[],off=0;
 files.forEach(function(f){var name=enc.encode(f.path),data=enc.encode(f.content),c=crc(data),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
  parts.push(new Uint8Array(h.buffer),name,data);
  var e=new DataView(new ArrayBuffer(46));e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint32(16,c,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,name.length,true);e.setUint32(42,off,true);
  cen.push(new Uint8Array(e.buffer),name);off+=30+name.length+data.length});
 var cs=cen.reduce(function(a,b){return a+b.length},0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
 return new Blob(parts.concat(cen,[new Uint8Array(end.buffer)]),{type:'application/zip'})}
document.getElementById('dl').onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(zip(P.files));a.download=(P.title||'godot-game').replace(/[\\\\/:*?"<>|]+/g,' ').trim()+'.zip';document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500)};
})();
</script></body></html>`
}

/** 웹 빌드가 붙은 Godot 프로젝트 — 공용 엔진(vibrexcup.com/godot/<버전>)으로 바로 플레이, 코드 보기·.zip 은 탭으로 */
function godotPlayerHtml(p: GodotProject, pck: string, ver: string): string {
  const base = `https://vibrexcup.com/godot/${ver}/godot`
  const viewer = godotViewerHtml(p)   // 코드 탭 = 기존 뷰어 (iframe srcdoc)
  const json = JSON.stringify(p).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>${esc(p.title)}</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden;font:13px -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
#canvas{display:block;width:100%;height:100%;outline:none}
#load{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#16181f;color:#c7cbd8}
#load .bar{width:220px;height:6px;border-radius:6px;background:#2a2e3c;overflow:hidden}#load .bar i{display:block;height:100%;width:0;background:#478cbf;transition:width .2s}
#load b{color:#fff;font-size:15px}
#tabs{position:fixed;bottom:10px;right:10px;display:flex;gap:6px;z-index:5;opacity:.88}
#tabs button{border:0;border-radius:8px;padding:6px 10px;background:rgba(22,24,31,.82);color:#e7e9f0;font-weight:700;cursor:pointer;backdrop-filter:blur(6px)}
#tabs button.on{background:#478cbf}
#code{position:fixed;inset:0;border:0;width:100%;height:100%;display:none;background:#16181f}
</style></head><body>
<canvas id="canvas" tabindex="0"></canvas>
<div id="load"><b>${esc(p.title)}</b><div class="bar"><i id="pg"></i></div><span id="lt">Godot 엔진 불러오는 중…</span></div>
<div id="tabs"><button id="tp" class="on">▶ 플레이</button><button id="tc">{ } 코드 · .zip</button></div>
<iframe id="code" sandbox="allow-scripts allow-downloads" title="code"></iframe>
<script type="application/json" id="${GODOT_JSON_ID}">${json}</script>
<script type="application/octet-stream" id="${GODOT_PCK_ID}">${pck}</script>
<script src="${base}.js"></script>
<script>
(function(){
var code=document.getElementById('code'),tp=document.getElementById('tp'),tc=document.getElementById('tc');
code.srcdoc=${JSON.stringify(viewer).replace(/</g, '\\u003c')};
tp.onclick=function(){code.style.display='none';tp.className='on';tc.className='';document.getElementById('canvas').focus()};
tc.onclick=function(){code.style.display='block';tc.className='on';tp.className=''};
var lt=document.getElementById('lt'),pg=document.getElementById('pg');
function fail(m){lt.textContent=m;lt.style.color='#f87171'}
if(typeof Engine==='undefined'){fail('엔진을 불러오지 못했어요 (네트워크 확인)');return}
var miss=Engine.getMissingFeatures({threads:false});if(miss.length){fail('이 브라우저에선 실행할 수 없어요: '+miss.join(', '));return}
var raw=atob(document.getElementById('${GODOT_PCK_ID}').textContent.trim()),pck=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)pck[i]=raw.charCodeAt(i);
var engine=new Engine({canvas:document.getElementById('canvas'),canvasResizePolicy:2,ensureCrossOriginIsolationHeaders:false,experimentalVK:false,focusCanvas:true,gdextensionLibs:[],serviceWorker:'',executable:'${base}',args:[],
 onProgress:function(c,t){if(t>0){pg.style.width=Math.min(100,c/t*100)+'%';lt.textContent='Godot 엔진 불러오는 중 '+Math.round(c/t*100)+'%'}}});
engine.init('${base}').then(function(){return engine.preloadFile(pck.buffer,'game.pck')}).then(function(){return engine.start({args:['--main-pack','game.pck']})})
 .then(function(){document.getElementById('load').style.display='none';document.getElementById('canvas').focus()})
 .catch(function(e){fail('실행 실패: '+(e&&e.message||e))});
})();
</script></body></html>`
}
