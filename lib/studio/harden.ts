// lib/studio/harden.ts — 생성된 게임 HTML 을 샌드박스(iframe sandbox="allow-scripts")에서도 안전하게.
// 샌드박스 iframe 에선 localStorage 접근이 SecurityError 를 던져 게임 전체가 멈추므로, 메모리 폴백을 먼저 심는다.
export const LS_SHIM = `<script>try{window.localStorage.getItem('__t')}catch(e){(function(){var m={};var s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};try{Object.defineProperty(window,'localStorage',{value:s,configurable:true})}catch(_){}try{Object.defineProperty(window,'sessionStorage',{value:s,configurable:true})}catch(_){}})()}</script>`

export function hardenHtml(html: string): string {
  if (html.includes("localStorage.getItem('__t')")) return html
  const i = html.search(/<head[^>]*>/i)
  if (i >= 0) { const end = html.indexOf('>', i) + 1; return html.slice(0, end) + LS_SHIM + html.slice(end) }
  const j = html.search(/<html[^>]*>/i)
  if (j >= 0) { const end = html.indexOf('>', j) + 1; return html.slice(0, end) + '<head>' + LS_SHIM + '</head>' + html.slice(end) }
  return LS_SHIM + html
}
