// lib/studio/templates.ts — "기본 셋팅 게임" 라이브러리.
// 프롬프트가 알려진 장르(테트리스/벽돌깨기/…)를 가리키면 미리 만들어 둔 완성본을 1차로 불러오고,
// 프롬프트에 추가 요구가 있으면 그 완성본을 베이스로 LLM 이 "수정"만 한다 → 처음부터 만드는 것보다 토큰·시간 절감.
// 템플릿 파일: lib/studio/templates/<slug>.json (scripts/gen-template.mjs 로 생성)
import tetris from './templates/tetris.json'
import breakout from './templates/breakout.json'
import snake from './templates/snake.json'
import flappy from './templates/flappy.json'
import runner from './templates/runner.json'
import shooter from './templates/shooter.json'
import pong from './templates/pong.json'
import { matchTemplateIn } from './template-match'

export interface GameTemplate {
  slug: string
  name: string
  keywords: string[]
  prompt: string      // 템플릿을 만들 때 쓴 프롬프트 (참고용)
  description: string // 모델이 남긴 설명
  html: string
}

export const TEMPLATES: GameTemplate[] = [tetris, breakout, snake, flappy, runner, shooter, pong] as GameTemplate[]

export { templateOnly, extrasOf } from './template-match'
export function matchTemplate(prompt: string): { template: GameTemplate; keyword: string } | null {
  return matchTemplateIn(TEMPLATES, prompt)
}

