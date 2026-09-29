import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hardenHtml, LS_SHIM } from '@/lib/studio/harden'
import { loadControls } from '@/lib/controls-server'

// 3D 게임이 불러오는 자체 호스팅 three.js 의 출처 (배포 도메인 + www)
const SITE_ORIGINS = 'https://vibrexcup.com https://www.vibrexcup.com'
// 미디어 라이브러리(3D 모델·이미지)가 올라가는 스토리지
const MEDIA_ORIGIN = 'https://*.supabase.co'

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

  // 이어하기 — 로그인한 회원의 저장본을 게임 스크립트보다 먼저 localStorage 에 심는다(게임은 평소처럼 자기 저장을 읽는다)
  let saveTag = ''
  try {
    const gameId = (withCols.data as { id?: string } | null)?.id
    if (gameId) {
      const supa = await createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (user) {
        const { data: sv } = await supa.from('game_saves').select('data').eq('user_id', user.id).eq('game_id', gameId).maybeSingle()
        const saved = (sv as { data?: Record<string, string> } | null)?.data
        if (saved && Object.keys(saved).length) {
          // 전역을 만들지 않는다 — 예전엔 var S 를 써서 게임의 S(상태 변수)와 충돌해 게임이 통째로 죽었다
          saveTag = `<script>try{(function(){var d=${JSON.stringify(saved).replace(/</g, '\\u003c')};for(var k in d)localStorage.setItem(k,d[k]);window.VIBREX_SAVE_LOADED=true})()}catch(e){}</script>`
        }
      }
    }
  } catch { /* 저장 테이블이 아직 없거나 비로그인 — 기기 저장만 쓴다 */ }

  // 서빙된 버전 꼬리표 — 부모(텔레메트리)가 세션에 version_id 를 기록한다
  const tag = `<script>window.VIBREX_VERSION_ID=${JSON.stringify(version.id)};try{parent.postMessage({type:'vibrex:version',id:window.VIBREX_VERSION_ID},'*')}catch(e){}</script>`
  let html = hardenHtml(version.html, { controls: await loadControls() })
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + tag) : tag + html
  // 이어하기 주입은 반드시 저장소 폴백(LS_SHIM) '뒤' 에 와야 한다.
  // 앞에 두면 저장소가 막힌 환경(앱 웹뷰·사파리)에서 복원이 통째로 실패하고 게임이 처음부터 시작된다.
  if (saveTag) {
    const at = html.indexOf(LS_SHIM)
    html = at >= 0
      ? html.slice(0, at + LS_SHIM.length) + saveTag + html.slice(at + LS_SHIM.length)
      : (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + saveTag) : saveTag + html)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    // 최상위 문서로 열려도 스크립트 격리 유지
    'Content-Security-Policy':
      // script-src 에 우리 도메인 — 3D 게임용 자체 호스팅 three.js(/vendor/three.min.js) 만 불러올 수 있다
      // script-src 에 우리 도메인 — 3D 게임용 자체 호스팅 three.js/addons(/vendor/*)
      // 3D 모델(.glb)·드라코 디코더는 fetch 로 받아야 해서 connect-src 에 우리 도메인·스토리지·blob 을 연다(그 외 외부 통신은 계속 차단)
      `sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline' blob: ${new URL(req.url).origin} ${SITE_ORIGINS}; style-src 'unsafe-inline'; img-src data: blob: ${SITE_ORIGINS} ${MEDIA_ORIGIN}; media-src data: blob:; connect-src data: blob: ${new URL(req.url).origin} ${SITE_ORIGINS} ${MEDIA_ORIGIN}; worker-src blob:; child-src blob:; frame-ancestors *;`,
    // 전역 X-Frame-Options(SAMEORIGIN) 대신 위 frame-ancestors 로 허용 (www ↔ apex, 관리자 호스트에서의 임베드)
    'X-Frame-Options': 'ALLOWALL',
    'Cache-Control': 'no-store',
    'X-Vibrex-Version': version.id,
  }
  if (setCookie) headers['Set-Cookie'] = setCookie
  return new Response(html, { headers })
}
