import type { Metadata } from 'next'
import MapBoard from '@/components/map/MapBoard'

export const metadata: Metadata = { title: '지도보드 — 지금 어디에서 게임이 만들어지고 있을까? | Vibrexcup', description: '스튜디오 생성·게임 게시·플레이가 일어나는 지역을 실시간 지도로 보여줍니다.' }

export default function MapPage() {
  return <MapBoard />
}
