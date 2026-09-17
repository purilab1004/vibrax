// 쇼츠 카테고리별 배경음 — 미디어 라이브러리 에셋 이름(playAsset 과 같은 이름). 쇼츠를 보는 동안 이어지도록 모두 반복 재생
export interface BgmTrack { name: string; loop: boolean; volume: number }

export const FEED_BGM: Record<string, BgmTrack> = {
  strategy: { name: 'slow_background_music', loop: true, volume: 1 },    // playAsset('slow_background_music')
  adventure: { name: 'background_music_2', loop: true, volume: 1 },      // playAsset('background_music_2')
  action: { name: 'background_sound_1', loop: true, volume: 0.5 },       // playAsset('background_sound_1', { loop: true, volume: 0.5 })
  sports: { name: 'background_music_2', loop: true, volume: 1 },         // playAsset('background_music_2')
  reward: { name: 'balloon_game_music', loop: true, volume: 0.5 },       // playAsset('balloon_game_music', { loop: true, volume: 0.5 })
}

export const FEED_BGM_NAMES = [...new Set(Object.values(FEED_BGM).map((t) => t.name))]
