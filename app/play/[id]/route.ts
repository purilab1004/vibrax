import { createAdminClient } from '@/lib/supabase/admin'
import { hardenHtml } from '@/lib/studio/harden'
import { loadControls } from '@/lib/controls-server'

// 3D 게임이 불러오는 자체 호스팅 three.js 의 출처 (배포 도메인 + www)
const SITE_ORIGINS = 'https://vibrexcup.com https://www.vibrexcup.com'

// 게시된 스튜디오 게임 HTML 서빙.
// studio_versions는 RLS로 소유자만 읽을 수 있으므로 admin 클라이언트를 쓰되,
// games에 게시 레코드가 있는 프로젝트만 공개한다.
// 버전 선택: games.live_version_id(없으면 최신) — AJ 자율 튜닝 실험 중이면 세션 일부에 canary_version_id 를 서빙.
// 같은 사람이 실험 내내 같은 버전을 보도록 쿠키(vx_cb, 0~99 버킷)로 배정한다.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()

  // 마이그레이션 전(컬럼 없음)에는 예전 동작으로 폴백
  let game: { id: string; live_version_id?: string | null; canary_version_id?: string | null; canary_ratio?: number | null } | null = null
  const withCols = await admin.from('games').select('id,live_version_id,canary_version_id,canary_ratio').eq('studio_project_id', id).limit(1).maybeSingle()
  if (withCols.error) {
    const { data } = await admin.from('games').select('id').eq('studio_project_id', id).limit(1).maybeSingle()
    game = data as { id: string } | null
  } else game = withCols.data as typeof game
  if (!game) return new Response('Not Found', { status: 404 })

  // 카나리 버킷
  let setCookie: string | null = null
  let useCanary = false
  if (game.canary_version_id) {
    const cookie = req.headers.get('cookie') ?? ''
    const m = cookie.match(/(?:^|;\s*)vx_cb=(\d{1,2})(?:;|$)/)
    let bucket = m ? Number(m[1]) : NaN
    if (!Number.isFinite(bucket)) {
      bucket = Math.floor(Math.random() * 100)
      const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
      setCookie = `vx_cb=${bucket}; Path=/play; Max-Age=2592000; SameSite=Lax${secure}`
    }
    useCanary = bucket < Math.round((game.canary_ratio ?? 0.2) * 100)
  }
  type V = { id: string; html: string; version: number }
  let version: V | null = null
  if (useCanary) {
    const { data } = await admin.from('studio_versions').select('id,html,version').eq('id', game.canary_version_id!).maybeSingle()
    version = data as V | null
  }
  if (!version) {
    // 라이브 = 게시(업데이트) 시 지정한 live_version 그대로. 스튜디오에서 프롬프트로 수정해도 크리에이터가 '최신 버전 게시' 를 누르기 전엔 반영되지 않는다.
    // live_version 이 없는(옛) 게임만 최신 "사람이 만든" 버전을 서빙
    const liveRes = game.live_version_id ? await admin.from('studio_versions').select('id,html,version').eq('id', game.live_version_id).maybeSingle() : { data: null }
    version = (liveRes.data ?? null) as V | null
    if (!version) {
      const latestQ = withCols.error
        ? admin.from('studio_versions').select('id,html,version').eq('project_id', id).order('version', { ascending: false }).limit(1).maybeSingle()
        : admin.from('studio_versions').select('id,html,version').eq('project_id', id).neq('origin', 'auto').order('version', { ascending: false }).limit(1).maybeSingle()
      version = ((await latestQ).data ?? null) as V | null
    }
  }
  if (!version) return new Response('Not Found', { status: 404 })

  // 서빙된 버전 꼬리표 — 부모(텔레메트리)가 세션에 version_id 를 기록한다
  const tag = `<script>window.VIBREX_VERSION_ID=${JSON.stringify(version.id)};try{parent.postMessage({type:'vibrex:version',id:window.VIBREX_VERSION_ID},'*')}catch(e){}</script>`
  let html = hardenHtml(version.html, { controls: await loadControls() })
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + tag) : tag + html

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    // 최상위 문서로 열려도 스크립트 격리 유지
    'Content-Security-Policy':
      // script-src 에 우리 도메인 — 3D 게임용 자체 호스팅 three.js(/vendor/three.min.js) 만 불러올 수 있다
      `sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline' ${new URL(req.url).origin} ${SITE_ORIGINS}; style-src 'unsafe-inline'; img-src data:; media-src data:; frame-ancestors *;`,
    // 전역 X-Frame-Options(SAMEORIGIN) 대신 위 frame-ancestors 로 허용 (www ↔ apex, 관리자 호스트에서의 임베드)
    'X-Frame-Options': 'ALLOWALL',
    'Cache-Control': 'no-store',
    'X-Vibrex-Version': version.id,
  }
  if (setCookie) headers['Set-Cookie'] = setCookie
  return new Response(html, { headers })
}
