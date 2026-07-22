import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/submit', '/login', '/signup'],
      },
    ],
    sitemap: 'https://vibrexcup.com/sitemap.xml',
  }
}
