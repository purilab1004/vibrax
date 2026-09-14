import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatViewers, compactNum } from './format'

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

test('compactNum — 배지용 숫자 축약', () => {
  assert.equal(compactNum(0), '0'); assert.equal(compactNum(999), '999')
  assert.equal(compactNum(5068), '5K'); assert.equal(compactNum(5500), '5.5K'); assert.equal(compactNum(1050), '1K')
  assert.equal(compactNum(12340), '12K'); assert.equal(compactNum(999_999), '1000K')
  assert.equal(compactNum(1_200_000), '1.2M'); assert.equal(compactNum(2_000_000), '2M')
})
