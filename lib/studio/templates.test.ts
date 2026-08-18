import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templateOnly } from './template-match'

test('templateOnly: 장르 이름 + 군더더기면 true', () => {
  assert.equal(templateOnly('테트리스 게임 만들어줘', '테트리스'), true)
  assert.equal(templateOnly('테트리스 만들어 줘!', '테트리스'), true)
  assert.equal(templateOnly('간단한 벽돌깨기 게임 하나 만들어주세요', '벽돌깨기'), true)
  assert.equal(templateOnly('make me a tetris game please', 'tetris'), true)
})
test('templateOnly: 추가 요구가 있으면 false', () => {
  assert.equal(templateOnly('테트리스 게임 만들어줘. 배경은 우주로, 블록은 과일 모양으로', '테트리스'), false)
  assert.equal(templateOnly('2인용 벽돌깨기', '벽돌깨기'), false)
})
