// lib/studio/templates.ts — "기본 셋팅 게임" 라이브러리.
// 프롬프트가 알려진 장르(테트리스/벽돌깨기/…)를 가리키면 미리 만들어 둔 완성본을 1차로 불러오고,
// 프롬프트에 추가 요구가 있으면 그 완성본을 베이스로 LLM 이 "수정"만 한다 → 처음부터 만드는 것보다 토큰·시간 절감.
// 템플릿 파일: lib/studio/templates/<slug>.json (scripts/gen-template.mjs 로 생성)
import tetris from './templates/tetris.json'
import breakout from './templates/breakout.json'
import snake from './templates/snake.json'
import flappy from './templates/flappy.json'
import runner from './templates/runner.json'
import runnerDouble from './templates/runner-double.json'
import shooter from './templates/shooter.json'
import pong from './templates/pong.json'
import stock from './templates/stock.json'
import actionAdventure from './templates/action-adventure.json'
import asteroids from './templates/asteroids.json'
import autoBattler from './templates/auto-battler.json'
import battleRoyale from './templates/battle-royale.json'
import bomberman from './templates/bomberman.json'
import crossyRoad from './templates/crossy-road.json'
import deckbuilder from './templates/deckbuilder.json'
import doodleJump from './templates/doodle-jump.json'
import eduQuiz from './templates/edu-quiz.json'
import farming from './templates/farming.json'
import fighting from './templates/fighting.json'
import flight from './templates/flight.json'
import gacha from './templates/gacha.json'
import gomoku from './templates/gomoku.json'
import helixJump from './templates/helix-jump.json'
import ioEat from './templates/io-eat.json'
import match3 from './templates/match3.json'
import maze from './templates/maze.json'
import memoryMatch from './templates/memory-match.json'
import metroidvania from './templates/metroidvania.json'
import minesweeper from './templates/minesweeper.json'
import mobaLane from './templates/moba-lane.json'
import pacman from './templates/pacman.json'
import party from './templates/party.json'
import puzzle2048 from './templates/puzzle-2048.json'
import quiz from './templates/quiz.json'
import racing from './templates/racing.json'
import reaction from './templates/reaction.json'
import rhythm from './templates/rhythm.json'
import rhythmJump from './templates/rhythm-jump.json'
import roguelike from './templates/roguelike.json'
import rpgAction from './templates/rpg-action.json'
import rpgIdle from './templates/rpg-idle.json'
import rpgTurn from './templates/rpg-turn.json'
import rtsMini from './templates/rts-mini.json'
import sandbox from './templates/sandbox.json'
import shooterFps from './templates/shooter-fps.json'
import shooterLoot from './templates/shooter-loot.json'
import shooterTopdown from './templates/shooter-topdown.json'
import slidingPuzzle from './templates/sliding-puzzle.json'
import slingshot from './templates/slingshot.json'
import soulslike from './templates/soulslike.json'
import sports from './templates/sports.json'
import sportsShot from './templates/sports-shot.json'
import stack from './templates/stack.json'
import strategyTurn from './templates/strategy-turn.json'
import sudoku from './templates/sudoku.json'
import survival from './templates/survival.json'
import tankDuel from './templates/tank-duel.json'
import towerDefense from './templates/tower-defense.json'
import tycoon from './templates/tycoon.json'
import typing from './templates/typing.json'
import visualNovel from './templates/visual-novel.json'
import whackAMole from './templates/whack-a-mole.json'
import wordle from './templates/wordle.json'
import { matchTemplateIn } from './template-match'

export interface GameTemplate {
  slug: string
  name: string
  keywords: string[]
  prompt: string      // 템플릿을 만들 때 쓴 프롬프트 (참고용)
  description: string // 모델이 남긴 설명
  html: string
  // 조작 변형 템플릿: 같은 genreGroup 끼리 조작만 다른 변형. 조작 선택 카드로 고른다.
  genreGroup?: string   // 예: 'runner' — 같은 장르 그룹
  controlLabel?: string // 예: '이단 점프' — 이 변형의 조작 이름 (카드 라벨)
  controls?: { label: string; keys: string; desc?: string } // 이 템플릿의 조작 설명
}

export const TEMPLATES: GameTemplate[] = [tetris, breakout, snake, flappy, runner, runnerDouble, shooter, pong, stock, actionAdventure, asteroids, autoBattler, battleRoyale, bomberman, crossyRoad, deckbuilder, doodleJump, eduQuiz, farming, fighting, flight, gacha, gomoku, helixJump, ioEat, match3, maze, memoryMatch, metroidvania, minesweeper, mobaLane, pacman, party, puzzle2048, quiz, racing, reaction, rhythm, rhythmJump, roguelike, rpgAction, rpgIdle, rpgTurn, rtsMini, sandbox, shooterFps, shooterLoot, shooterTopdown, slidingPuzzle, slingshot, soulslike, sports, sportsShot, stack, strategyTurn, sudoku, survival, tankDuel, towerDefense, tycoon, typing, visualNovel, whackAMole, wordle] as GameTemplate[]

export { templateOnly, extrasOf } from './template-match'
export function matchTemplate(prompt: string): { template: GameTemplate; keyword: string } | null {
  return matchTemplateIn(TEMPLATES, prompt)
}

