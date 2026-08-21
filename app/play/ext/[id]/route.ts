// 외부 링크 게임 프록시 플레이 — 등록된 게임의 외부 HTML 을 우리 오리진으로 서빙하며
// vibrex 브리지(아바타·오토파일럿·터치 컨트롤러·AJ 이벤트)를 주입한다 → 같은 출처가 되어 AI 참여가 가능.
// <base> 로 상대 경로 에셋은 원본 도메인에서 로드. 실패(비HTML·차단·사설망·크기초과)면 502 → 클라이언트는 원본 iframe 으로 폴백.
import { createAdminClient } from '@/lib/supabase/admin'
import { hardenHtml } from '@/lib/studio/harden'

export const maxDuration = 30
// SSRF 방지 — 사설/링크로컬/루프백 대역 차단 (등록된 게임 URL 만, 그리고 https 공인 호스트만 프록시)
const BLOCKED_HOST = /^(localhost$|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|fc|fd|fe80)/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('games').select('id,play_url,title').eq('id', id).maybeSingle()
  const game = data as { id: string; play_url: string; title: string } | null
  if (!game) return new Response('Not Found', { status: 404 })
  let url: URL
  try { url = new URL(game.play_url) } catch { return new Response('bad url', { status: 400 }) }
  if (url.protocol !== 'https:' || BLOCKED_HOST.test(url.hostname) || !url.hostname.includes('.')) return new Response('forbidden origin', { status: 403 })
  // 우리 표준 게임이면 원 경로로
  if (url.hostname.endsWith('vibrexcup.com') && url.pathname.startsWith('/play/')) return Response.redirect(game.play_url, 302)
  let html = ''
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12_000)
    const r = await fetch(url.toString(), { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VibrexPlay/1.0)', Accept: 'text/html' }, redirect: 'follow' })
    clearTimeout(to)
    const ct = r.headers.get('content-type') ?? ''
    if (!r.ok || !ct.includes('text/html')) return new Response('not html', { status: 502 })
    const buf = await r.arrayBuffer()
    if (buf.byteLength > 2_500_000) return new Response('too large', { status: 502 })
    html = new TextDecoder('utf-8').decode(buf)
  } catch { return new Response('fetch failed', { status: 502 }) }
  // <base> 주입 — 상대 경로 에셋을 원본 도메인에서 로드
  const dir = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/[^/]*$/, '')
  const baseTag = `<base href="${url.origin}${dir}">`
  if (!/<base\s/i.test(html)) {
    const i = html.search(/<head[^>]*>/i)
    if (i >= 0) { const end = html.indexOf('>', i) + 1; html = html.slice(0, end) + baseTag + html.slice(end) }
    else html = baseTag + html
  }
  // vibrex 브리지 주입 (아바타·오토파일럿·터치·AJ·localStorage 폴백)
  html = hardenHtml(html)
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors 'self' https://vibrexcup.com https://*.vibrexcup.com https://*.vercel.app http://localhost:*;",
      'X-Frame-Options': 'ALLOWALL',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
