import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — Vibrexcup 이야기',
  description:
    'Vibrexcup 소개 — 바이브코딩으로 게임을 만들고, AI 스트리머 AJ가 중계하고, 나만의 AI AGENT가 수익까지 만들어가는 새로운 게임 플랫폼의 이야기입니다.',
  alternates: { canonical: 'https://vibrexcup.com/about' },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
