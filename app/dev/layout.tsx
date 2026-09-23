import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DEV — AJ API · 크롬 확장 가이드',
  description: '내 Vibrexcup AJ를 밖에서 쓰는 방법 — 크롬 확장 설치(무료), 개발자 API 키 발급과 과금, /api/v1/aj 레퍼런스와 코드 예제.',
  alternates: { canonical: 'https://vibrexcup.com/dev' },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children
}
