import { Jua, Black_Han_Sans, Space_Grotesk, JetBrains_Mono } from 'next/font/google'

// 카드 훅 타이틀용 — 통통한 라운드 한글 (Jua)
export const titleFont = Jua({ weight: '400', subsets: ['latin'] })
// 쇼츠 타이틀(갤럭시·레트로 크롬 3D)용 — 굵고 각진 한글 (Black Han Sans)
export const galaxyFont = Black_Han_Sans({ weight: '400', subsets: ['latin'] })
// /dev 개발자 페이지 — 기하학 디스플레이 + 모노 라벨
export const devDisplay = Space_Grotesk({ weight: ['500', '700'], subsets: ['latin'], display: 'swap' })
export const devMono = JetBrains_Mono({ weight: ['400', '500'], subsets: ['latin'], display: 'swap' })
