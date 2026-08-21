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
