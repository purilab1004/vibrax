import type { Metadata } from 'next'
import { Suspense } from 'react'
import LibraryClient from '@/components/library/LibraryClient'

export const metadata: Metadata = {
  title: '갤러리 — 게임 디자인 검색 | Vibrexcup',
  description: '캐릭터·배경·아이템·효과음 디자인 라이브러리. 디자이너로 접수하고 작품을 등록하면 회원이 게임에 쓸 때마다 크레딧이 100% 디자이너에게 쌓입니다.',
  alternates: { canonical: 'https://vibrexcup.com/gallery' },
}

export default function LibraryPage() {
  return <Suspense fallback={null}><LibraryClient /></Suspense>
}
