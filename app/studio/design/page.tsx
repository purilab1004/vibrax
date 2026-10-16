import type { Metadata } from 'next'
import DesignerStudio from '@/components/designer/DesignerStudio'

export const metadata: Metadata = {
  title: '디자이너 AI — Studio | Vibrexcup',
  description: 'AI 이미지·3D 모델 생성, 내 드라이브, 갤러리 검색 — 게임 디자이너를 위한 작업 공간',
  robots: { index: false },
}

export default function DesignerStudioPage() {
  return <DesignerStudio />
}
