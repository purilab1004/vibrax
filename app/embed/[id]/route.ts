// 외부 사이트 임베드용 플레이어 — <iframe src="https://vibrexcup.com/embed/{id}"> 로 어떤 사이트에서든 게임을 붙일 수 있다.
// 게임 자체는 /play/{id}(샌드박스) 를 안쪽 iframe 으로 띄우고, 우상단에 Vibrexcup 배지(원본 게임 페이지 링크)만 겹친다.
// 모바일: 터치 조이스틱·버튼은 게임 shim 이 제공하므로 그대로 동작. 세로/가로 모두 iframe 크기에 맞춰 채운다.
import { createAdminClient } from '@/lib/supabase/admin'
import { playSrc } from '@/lib/game-src'

const SITE = 'https://vibrexcup.com'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not Found', { status: 404 })
  const admin = createAdminClient()
  const { data } = await admin.from('games').select('id,title,play_url,genre,thumbnail_url').eq('id', id).maybeSingle()
  const game = data as { id: string; title: string; play_url: string; genre: string | null; thumbnail_url: string | null } | null
  if (!game) return new Response('Not Found', { status: 404 })
  // 조회수 — 임베드 재생도 집계 (실패해도 무시)
  try { await admin.rpc('increment_view_count', { game_id: game.id }) } catch { /* noop */ }
  const src = playSrc(game)
  const srcAbs = src.startsWith('http') ? src : SITE + src
  const pageUrl = `${SITE}/games/${game.id}`
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover"><meta name="robots" content="noindex"><title>${esc(game.title)} · Vibrexcup</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
.vbx-badge{position:absolute;top:8px;right:8px;z-index:5;display:flex;align-items:center;gap:6px;height:26px;padding:0 10px 0 8px;border-radius:999px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);color:#fff;font:700 10px/1 -apple-system,system-ui,sans-serif;letter-spacing:.12em;text-decoration:none;opacity:.85;transition:opacity .2s}
.vbx-badge:hover{opacity:1}.vbx-badge b{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee}
.vbx-badge span{max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;letter-spacing:0;opacity:.8}
@media (max-width:420px){.vbx-badge span{display:none}}</style></head>
<body><iframe src="${esc(srcAbs)}" title="${esc(game.title)}" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
<a class="vbx-badge" href="${esc(pageUrl)}?utm_source=embed" target="_blank" rel="noopener"><b></b>VIBREXCUP<span>· ${esc(game.title)}</span></a>
<script>addEventListener('message',function(e){var d=e.data;if(!d||typeof d!=='object')return;if(d.type==='vibrex:manifest-request')return;});</script>
</body></html>`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 어떤 사이트에서든 iframe 으로 삽입 가능 (전역 X-Frame-Options SAMEORIGIN 대신)
      'Content-Security-Policy': 'frame-ancestors *;',
      'X-Frame-Options': 'ALLOWALL',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}
