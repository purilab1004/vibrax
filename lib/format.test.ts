import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatViewers } from './format'

test('formatViewers: 1000 미만은 그대로', () => {
  assert.equal(formatViewers(0), '0')
  assert.equal(formatViewers(999), '999')
})

test('formatViewers: K 단위 소수 1자리', () => {
  assert.equal(formatViewers(1234), '1.2K')
  assert.equal(formatViewers(13358), '13.4K')
})

test('formatViewers: 정수로 떨어지면 소수점 생략', () => {
  assert.equal(formatViewers(2000), '2K')
})

test('formatViewers: M 단위', () => {
  assert.equal(formatViewers(1250000), '1.3M')
})
