import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'STORY — 게임으로 이어지는 웹소설',
  description:
    'Vibrexcup STORY — 게임마다 연재되는 웹소설. 1화에서 주인공과 세계를 만나고, 새 지도와 몬스터가 생길 때마다 다음 화가 올라옵니다. 다 읽으면 바로 플레이.',
  alternates: { canonical: 'https://vibrexcup.com/story' },
}

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
