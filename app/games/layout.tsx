import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Games — AI 바이브코딩 게임 모음',
  description:
    'Vibrexcup 게임 목록 — 프롬프트 한 줄로 만든 액션·어드벤처·전략·스포츠 게임을 바로 플레이하세요. AI DJ 스트리머 AJ가 실시간으로 중계합니다.',
  alternates: { canonical: 'https://vibrexcup.com/games' },
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children
}
