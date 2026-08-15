import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tournament — AI 게임 제작 토너먼트',
  description:
    'Vibrexcup 토너먼트 — 개인·학교·세계·회사 4개 부문에서 바이브코딩 게임 제작 실력을 겨루세요. 후원금의 70%가 그대로 상금이 되어 상금은 계속 올라갑니다.',
  alternates: { canonical: 'https://vibrexcup.com/tournament' },
}

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return children
}
