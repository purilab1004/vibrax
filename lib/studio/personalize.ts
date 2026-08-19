// 템플릿 개인화 — LLM 없이 제목·색조를 프로젝트마다 다르게 (같은 템플릿이라도 회원마다 다른 게임처럼 보이게)
import { hashOf } from '@/lib/studio/hash'

interface Variant { title: string; en?: string }
const VARIANTS: Record<string, { replace: string[]; titles: Variant[] }> = {
  tetris: { replace: ['NEON TETRIS', '네온 테트리스'], titles: [
    { title: '네온 테트리스', en: 'NEON TETRIS' }, { title: '블록 폭풍', en: 'BLOCK STORM' }, { title: '루미노 스택', en: 'LUMINO STACK' }, { title: '사이버 블록스', en: 'CYBER BLOX' }, { title: '그리드 러시', en: 'GRID RUSH' }, { title: '픽셀 타워', en: 'PIXEL TOWER' }, { title: '스타 테트라', en: 'STAR TETRA' }, { title: '오로라 블록', en: 'AURORA BLOCKS' },
  ] },
  breakout: { replace: ['파스텔 벽돌깨기'], titles: [{ title: '파스텔 벽돌깨기' }, { title: '브릭 버스터' }, { title: '캔디 브레이커' }, { title: '레인보우 스매시' }, { title: '블록 크래셔' }, { title: '스타 브릭스' }, { title: '팝 브릭 히어로' }] },
  snake: { replace: ['클래식 스네이크'], titles: [{ title: '클래식 스네이크' }, { title: '네온 스네이크' }, { title: '스네이크 러시' }, { title: '정글 뱀 대모험' }, { title: '픽셀 스네이크' }, { title: '스네이크 리턴즈' }, { title: '코브라 퀘스트' }] },
  flappy: { replace: ['둥이 새의 하늘여행'], titles: [{ title: '둥이 새의 하늘여행' }, { title: '플래피 스카이' }, { title: '삐약이의 비행' }, { title: '구름 위 날개' }, { title: '스카이 호퍼' }, { title: '펭이의 하늘 점프' }, { title: '윙윙 어드벤처' }] },
  runner: { replace: ['🦖 무한 러너', '공룡 무한 러너'], titles: [{ title: '공룡 무한 러너' }, { title: '다이노 대시' }, { title: '사막 질주' }, { title: '점프 렉스' }, { title: '러너 익스프레스' }, { title: '카툰 다이노 런' }, { title: '무한 질주 챔피언' }] },
  shooter: { replace: ['스타 디펜더'], titles: [{ title: '스타 디펜더' }, { title: '갤럭시 가디언' }, { title: '네뷸라 스트라이크' }, { title: '코스모 블래스터' }, { title: '스타쉽 서바이버' }, { title: '오리온 디펜스' }, { title: '아스트로 파이터' }] },
  pong: { replace: ['레트로 퐁'], titles: [{ title: '레트로 퐁' }, { title: '네온 퐁' }, { title: '핑퐁 듀얼' }, { title: '레이저 패들' }, { title: '아케이드 퐁' }, { title: '스피드 퐁' }, { title: '픽셀 라켓' }] },
}
const HUES = [0, 35, 70, 110, 150, 195, 240, 285, 320]

export function personalizeTemplate(slug: string, html: string, seed: string): { html: string; title: string } {
  const v = VARIANTS[slug]
  const h = hashOf(seed)
  if (!v) return { html, title: '' }
  const pick = v.titles[h % v.titles.length]
  let out = html
  // 표시 제목 치환 (영문 h1 이 있으면 영문 변형, 나머지는 한글)
  for (const token of v.replace) {
    const isEn = /^[A-Z0-9 ]+$/.test(token.replace(/[^\x00-\x7F]/g, ''))
    const rep = isEn && pick.en ? pick.en : pick.title
    out = out.split(token).join(rep)
  }
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${pick.title}</title>`)
  // 색조 변형 — 첫 번째 변형(원본)은 그대로, 나머지는 hue-rotate 로 팔레트 전체를 돌린다
  const hue = HUES[(h >> 3) % HUES.length]
  if (hue !== 0) {
    const css = `<style id="vx-theme">html{filter:hue-rotate(${hue}deg) saturate(1.05)}</style>`
    out = out.includes('</head>') ? out.replace('</head>', `${css}</head>`) : css + out
  }
  return { html: out, title: pick.title }
}
