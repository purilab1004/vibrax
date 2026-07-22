import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
