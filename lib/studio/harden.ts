// lib/studio/harden.ts — 생성된 게임 HTML 을 샌드박스(iframe sandbox="allow-scripts")에서도 안전하게.
// 샌드박스 iframe 에선 localStorage 접근이 SecurityError 를 던져 게임 전체가 멈추므로, 메모리 폴백을 먼저 심는다.
export const LS_SHIM = `<script>try{window.localStorage.getItem('__t')}catch(e){(function(){var m={};var s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};try{Object.defineProperty(window,'localStorage',{value:s,configurable:true})}catch(_){}try{Object.defineProperty(window,'sessionStorage',{value:s,configurable:true})}catch(_){}})()}</script>`

// AJ 텔레메트리 브리지 — 게임이 AJ.event('start'|'score'|'over'|'level'|'restart', {...}) 를 부르면 부모(플레이어)로 postMessage.
// 호출이 없는 옛 게임도 세션 길이는 측정된다. (파싱/보안: 부모는 event.data.type === 'aj:event' 만 본다)
export const AJ_SHIM = `<script>(function(){var t0=Date.now();function post(n,d){try{parent.postMessage({type:'aj:event',name:String(n),data:d==null?null:d,t:Date.now()-t0},'*')}catch(e){}}window.AJ={event:post,start:function(d){post('start',d)},score:function(s){post('score',{score:Number(s)||0})},over:function(s){post('over',{score:Number(s)||0})},level:function(l){post('level',{level:l})},restart:function(){post('restart')}};window.addEventListener('load',function(){post('load')});var first=false;['keydown','pointerdown','touchstart'].forEach(function(ev){window.addEventListener(ev,function(){if(!first){first=true;post('first_input')}},{passive:true})});})();</script>`

// 아바타 참여 브리지 — 부모가 postMessage({type:'vibrex:avatar', image, name}) 를 보내면
//  1) window.VIBREX_AVATAR = { image, name, img } 를 세팅하고 window 에 'vibrex:avatar' 이벤트를 쏜다 (게임이 플레이어 스킨으로 사용)
//  2) 게임이 300ms 안에 window.vibrexAvatarAck() 를 부르지 않으면(구형 게임) 화면 하단 중앙에 떠다니는 아바타 동반자(DOM)를 보여준다
//  {type:'vibrex:avatar-remove'} 면 모두 원복.
export const AVATAR_SHIM = `<script>(function(){var st={el:null,acked:false,timer:null};function clear(){if(st.timer){clearTimeout(st.timer);st.timer=null}if(st.el){st.el.remove();st.el=null}st.acked=false;window.VIBREX_AVATAR=null;try{window.dispatchEvent(new CustomEvent('vibrex:avatar-remove'))}catch(e){}}window.vibrexAvatarAck=function(){st.acked=true;if(st.timer){clearTimeout(st.timer);st.timer=null}if(st.el){st.el.remove();st.el=null}};function fallback(image,name){if(st.el||st.acked)return;var w=document.createElement('div');w.setAttribute('data-vibrex-avatar','');w.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:4px;';var im=document.createElement('img');im.src=image;im.alt='';im.style.cssText='width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5));animation:vbxBob 1.6s ease-in-out infinite;';var lb=document.createElement('div');lb.textContent=name||'';lb.style.cssText='font:600 10px/1 -apple-system,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:999px;'+(name?'':'display:none;');var sty=document.createElement('style');sty.textContent='@keyframes vbxBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}';w.appendChild(sty);w.appendChild(im);w.appendChild(lb);(document.body||document.documentElement).appendChild(w);st.el=w}window.addEventListener('message',function(e){var d=e.data;if(!d||typeof d!=='object')return;if(d.type==='vibrex:avatar'&&typeof d.image==='string'){clear();var img=new Image();img.src=d.image;window.VIBREX_AVATAR={image:d.image,name:d.name||'',img:img};try{window.dispatchEvent(new CustomEvent('vibrex:avatar',{detail:window.VIBREX_AVATAR}))}catch(e2){}st.timer=setTimeout(function(){if(!st.acked)fallback(d.image,d.name)},300);try{parent.postMessage({type:'vibrex:avatar-received'},'*')}catch(e3){}}else if(d.type==='vibrex:avatar-remove'){clear()}});})();</script>`

export function hardenHtml(html: string): string {
  let out = html
  if (!out.includes("window.vibrexAvatarAck=")) {
    const i = out.search(/<head[^>]*>/i)
    if (i >= 0) { const end = out.indexOf('>', i) + 1; out = out.slice(0, end) + AVATAR_SHIM + out.slice(end) }
    else out = AVATAR_SHIM + out
  }
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
