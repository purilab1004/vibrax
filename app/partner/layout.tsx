import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partner — 파트너를 모집합니다',
  description:
    'Vibrexcup 파트너 모집 — 학교·기업·단체·기관과 함께 AI 게임 제작 교육, 사내 해커톤, 토너먼트 후원 등 다양한 협력을 준비하고 있습니다.',
  alternates: { canonical: 'https://vibrexcup.com/partner' },
}

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children
}
