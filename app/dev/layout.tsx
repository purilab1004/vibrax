import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DEV — Vibrex 데스크톱 게임 빌더 · AJ API · 크롬 확장',
  description: '프롬프트로 게임을 만드는 데스크톱 빌더 Vibrex(Mac·Windows) 다운로드, 내 AJ 크롬 확장, 개발자 API 키와 /api/v1 레퍼런스·코드 예제.',
  alternates: { canonical: 'https://vibrexcup.com/dev' },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children
}
