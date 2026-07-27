import type { MetadataRoute } from 'next'

// 정책: AI "검색" 봇(출처 링크로 유입을 만들어주는 인덱서)은 허용,
// AI "학습·실시간 브라우징" 봇(사이트 통복사에 쓰이는 것)은 차단.
// robots.txt는 신사협정이므로 실제 강제는 proxy.ts의 UA 403이 담당한다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/submit', '/login', '/signup', '/admin', '/studio', '/profile', '/credits'],
      },
      // ── 허용: 검색 인덱서 (검색 결과에 출처로 노출 → 트래픽 유입) ──
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Yeti', allow: '/' },              // 네이버
      { userAgent: 'Daum', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },     // ChatGPT 검색 인덱스
      { userAgent: 'Claude-SearchBot', allow: '/' },  // Claude 검색 인덱스
      { userAgent: 'PerplexityBot', allow: '/' },     // Perplexity 검색 인덱스
      // ── 차단: LLM 학습 크롤러 (사이트 내용이 모델에 흡수되는 경로) ──
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' }, // Gemini 학습 옵트아웃
      { userAgent: 'Applebot-Extended', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },           // Common Crawl (학습 데이터셋)
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'meta-externalagent', disallow: '/' },
      { userAgent: 'cohere-ai', disallow: '/' },
      // ── 차단: 사용자 지시 실시간 브라우징 ("이 사이트 복사해줘"의 통로) ──
      { userAgent: 'ChatGPT-User', disallow: '/' },
      { userAgent: 'Claude-User', disallow: '/' },
      { userAgent: 'Claude-Web', disallow: '/' },
      { userAgent: 'Perplexity-User', disallow: '/' },
    ],
    sitemap: 'https://vibrexcup.com/sitemap.xml',
  }
}
