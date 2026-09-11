import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankFor, nextTarget, TOP_N } from './leaderboard'

const row = (id: string, best: number) => ({ user_id: id, username: id, agent_name: null, best, achieved_at: '' })

test('rankFor — 비어 있으면 1점부터 1위', () => {
  assert.equal(rankFor({ top: [], full: false }, 0), 0)
  assert.equal(rankFor({ top: [], full: false }, 1), 1)
})
test('rankFor — 동점은 기존 기록이 위, 10위 밖이면 0', () => {
  const top = Array.from({ length: TOP_N }, (_, i) => row(`u${i}`, 1000 - i * 100))  // 1000..100
  assert.equal(rankFor({ top, full: true }, 1000), 2)
  assert.equal(rankFor({ top, full: true }, 1001), 1)
  assert.equal(rankFor({ top, full: true }, 101), 10)
  assert.equal(rankFor({ top, full: true }, 100), 0)
  assert.equal(rankFor({ top, full: true }, 50), 0)
})
test('rankFor — 내 기존 기록은 빼고 계산', () => {
  const top = [row('me', 900), row('a', 500)]
  assert.equal(rankFor({ top, full: false }, 600, 'me'), 1)
  assert.equal(rankFor({ top, full: false }, 600, null), 2)
})

test('nextTarget — 순위 밖/안/1위', () => {
  const top = Array.from({ length: TOP_N }, (_, i) => row(`u${i}`, 1000 - i * 100))  // 1000..100
  assert.deepEqual(nextTarget({ top, full: true }, 50), { rank: 0, target: 101, remain: 51, toRank: 10 })
  assert.deepEqual(nextTarget({ top, full: true }, 150), { rank: 10, target: 201, remain: 51, toRank: 9 })
  assert.deepEqual(nextTarget({ top, full: true }, 950), { rank: 2, target: 1001, remain: 51, toRank: 1 })
  assert.deepEqual(nextTarget({ top, full: true }, 1001), { rank: 1, target: null, remain: 0, toRank: null })
  assert.deepEqual(nextTarget({ top: [], full: false }, 0), { rank: 0, target: 1, remain: 1, toRank: 1 })
  assert.deepEqual(nextTarget({ top: [row('a', 500)], full: false }, 0), { rank: 0, target: 1, remain: 1, toRank: 2 })
})
