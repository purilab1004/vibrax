import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — 바이브코딩과 AI 게임 이야기',
  description:
    'Vibrexcup 블로그 — AI 게임 제작 가이드, 프롬프트 팁, 바이브코딩 트렌드, 플랫폼 업데이트 소식을 매일 전합니다.',
  alternates: { canonical: 'https://vibrexcup.com/blog' },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
