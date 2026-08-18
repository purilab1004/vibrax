// lib/studio/harden.ts — 생성된 게임 HTML 을 샌드박스(iframe sandbox="allow-scripts")에서도 안전하게.
// 샌드박스 iframe 에선 localStorage 접근이 SecurityError 를 던져 게임 전체가 멈추므로, 메모리 폴백을 먼저 심는다.
export const LS_SHIM = `<script>try{window.localStorage.getItem('__t')}catch(e){(function(){var m={};var s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};try{Object.defineProperty(window,'localStorage',{value:s,configurable:true})}catch(_){}try{Object.defineProperty(window,'sessionStorage',{value:s,configurable:true})}catch(_){}})()}</script>`

// AJ 텔레메트리 브리지 — 게임이 AJ.event('start'|'score'|'over'|'level'|'restart', {...}) 를 부르면 부모(플레이어)로 postMessage.
// 호출이 없는 옛 게임도 세션 길이는 측정된다. (파싱/보안: 부모는 event.data.type === 'aj:event' 만 본다)
export const AJ_SHIM = `<script>(function(){var t0=Date.now();function post(n,d){try{parent.postMessage({type:'aj:event',name:String(n),data:d==null?null:d,t:Date.now()-t0},'*')}catch(e){}}window.AJ={event:post,start:function(d){post('start',d)},score:function(s){post('score',{score:Number(s)||0})},over:function(s){post('over',{score:Number(s)||0})},level:function(l){post('level',{level:l})},restart:function(){post('restart')}};window.addEventListener('load',function(){post('load')});var first=false;['keydown','pointerdown','touchstart'].forEach(function(ev){window.addEventListener(ev,function(){if(!first){first=true;post('first_input')}},{passive:true})});})();</script>`

export function hardenHtml(html: string): string {
  let out = html
  if (!out.includes("parent.postMessage({type:'aj:event'")) {
    const i = out.search(/<head[^>]*>/i)
    if (i >= 0) { const end = out.indexOf('>', i) + 1; out = out.slice(0, end) + AJ_SHIM + out.slice(end) }
    else out = AJ_SHIM + out
  }
  html = out
  if (html.includes("localStorage.getItem('__t')")) return html
  const i = html.search(/<head[^>]*>/i)
  if (i >= 0) { const end = html.indexOf('>', i) + 1; return html.slice(0, end) + LS_SHIM + html.slice(end) }
  const j = html.search(/<html[^>]*>/i)
  if (j >= 0) { const end = html.indexOf('>', j) + 1; return html.slice(0, end) + '<head>' + LS_SHIM + '</head>' + html.slice(end) }
  return LS_SHIM + html
}
