import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVisemeTrack, sampleViseme } from './visemes.ts'

test('builds open+close keys per word, sorted', () => {
  const track = buildVisemeTrack(['hi', 'yo'], [0, 100], [100, 100])
  for (let i = 1; i < track.length; i++) assert.ok(track[i].t >= track[i - 1].t)
  assert.ok(track.some((k) => k.value > 0.5))           // mouth opens
  assert.equal(track[track.length - 1].value, 0)        // ends closed
})

test('empty input yields a single closed key', () => {
  const track = buildVisemeTrack([], [], [])
  assert.deepEqual(track, [{ t: 0, value: 0 }])
})

test('sampleViseme interpolates and clamps', () => {
  const track = [{ t: 0, value: 0 }, { t: 100, value: 1 }]
  assert.equal(sampleViseme(track, -10), 0)
  assert.equal(sampleViseme(track, 50), 0.5)
  assert.equal(sampleViseme(track, 999), 1)
})
