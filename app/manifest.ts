import type { MetadataRoute } from 'next'

// PWA 매니페스트 — "홈 화면에 추가"로 설치되는 앱. 스토어 없이도 앱처럼 실행된다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vibrexcup 비브렉스컵',
    short_name: 'Vibrexcup',
    description: '프롬프트 한 줄로 게임을 만들고, AI 스트리머 AJ와 함께 전 세계와 공유하는 AI 게임 플랫폼.',
    start_url: '/?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fcfaf5',
    theme_color: '#2563eb',
    lang: 'ko',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '게임', short_name: '게임', url: '/games' },
      { name: '스튜디오', short_name: '만들기', url: '/studio' },
    ],
  }
}
