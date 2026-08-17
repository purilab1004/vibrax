import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 보안 헤더 — 클릭재킹/스니핑/레퍼러 유출/불필요 권한 차단
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(self)' }, // camera/mic: /broadcast 폰 방송용
        ],
      },
    ]
  },
  // 구 도메인(vibrax-rho.vercel.app) → vibrexcup.com 영구 리다이렉트
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'vibrax-rho.vercel.app' }],
        destination: 'https://vibrexcup.com/:path*',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
