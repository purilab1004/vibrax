// 게임 재생 소스 — 우리 표준 게임(/play/…)은 그대로, 외부 링크 게임은 프록시(/play/ext/{id})로 서빙해
// vibrex 브리지(아바타 참여·오토파일럿·터치 컨트롤러)를 주입한다. 프록시 실패 시 클라이언트가 원본으로 폴백.
export function playSrc(game: { id: string; play_url: string }): string {
  try {
    const u = new URL(game.play_url, typeof location !== 'undefined' ? location.href : 'https://vibrexcup.com')
    const isOurs = u.hostname.endsWith('vibrexcup.com') && u.pathname.startsWith('/play/')
    if (isOurs || u.protocol !== 'https:') return game.play_url
    return `/play/ext/${game.id}`
  } catch { return game.play_url }
}

/** iOS Safari/WebView 는 iframe 을 내용(예: 400px 캔버스) 크기만큼 넓혀 버려 화면 오른쪽이 잘린다 — width:1px + min-width:100% 로 컨테이너 폭에 고정 */
export const IOS_IFRAME_FIT = { width: '1px', minWidth: '100%' } as const
