import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Studio — 프롬프트로 게임 만들기',
  description:
    'Vibrexcup 스튜디오 — 프롬프트 한 줄이면 AI가 게임을 만들어 바로 실행해줍니다. 자체 프롬프트 빌드로 나만의 게임을 완성하고 게시하세요.',
  alternates: { canonical: 'https://vibrexcup.com/studio' },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
