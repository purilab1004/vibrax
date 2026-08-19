import type { MetadataRoute } from 'next'
import { loadLlmPilot } from '@/lib/llmpilot/settings'

// 정책: AI "검색" 봇(출처 링크로 유입을 만들어주는 인덱서)은 허용,
// AI "학습·실시간 브라우징" 봇(사이트 통복사에 쓰이는 것)은 차단.
// robots.txt는 신사협정이므로 실제 강제는 proxy.ts의 UA 403이 담당한다.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'admin') return { rules: [{ userAgent: '*', disallow: '/' }] }
  const s = await loadLlmPilot()
  const userBots = ['ChatGPT-User', 'Claude-User', 'Claude-Web', 'Perplexity-User', 'Gemini-Deep-Research', 'Google-CloudVertexBot']
  const trainBots = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent', 'cohere-ai']
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 로그인/개인 페이지만 색인 제외 — /studio는 메뉴 노출 대상이라 색인 허용
        disallow: ['/submit', '/login', '/signup', '/admin', '/profile', '/credits'],
      },
      // ── 허용: 검색 인덱서 (검색 결과에 출처로 노출 → 트래픽 유입) ──
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Yeti', allow: '/' },              // 네이버
      { userAgent: 'Daum', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },     // ChatGPT 검색 인덱스
      { userAgent: 'Claude-SearchBot', allow: '/' },  // Claude 검색 인덱스
      { userAgent: 'PerplexityBot', allow: '/' },     // Perplexity 검색 인덱스
      // ── LLMPilot 설정에 따라: 학습 크롤러 / 사용자 지시 브라우징 봇 ──
      ...trainBots.map(userAgent => ({ userAgent, [s.allowTraining ? 'allow' : 'disallow']: '/' })),
      ...userBots.map(userAgent => ({ userAgent, [s.allowUserBrowsing ? 'allow' : 'disallow']: '/' })),
    ],
    sitemap: 'https://vibrexcup.com/sitemap.xml',
  }
}
