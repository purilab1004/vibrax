import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linePoints } from './chart'

test('linePoints: 빈 배열은 빈 문자열', () => {
  assert.equal(linePoints([], 100, 40), '')
})

test('linePoints: 점 개수는 값 개수와 같다', () => {
  const pts = linePoints([1, 2, 3], 100, 40)
  assert.equal(pts.split(' ').length, 3)
})

test('linePoints: 최댓값은 상단(pad), 0은 하단(height-pad)에 매핑', () => {
  const pts = linePoints([0, 10], 100, 40, 2).split(' ')
  assert.equal(pts[0].split(',')[1], '38') // 0 → height - pad
  assert.equal(pts[1].split(',')[1], '2')  // max → pad
})

test('linePoints: 전부 0이어도 NaN 없이 하단 라인', () => {
  const pts = linePoints([0, 0, 0], 100, 40, 2)
  assert.ok(!pts.includes('NaN'))
})
