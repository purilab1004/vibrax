// lib/avatar/config.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig, defaultConfig } from './config.ts'

test('defaultConfig is a valid v1 config', () => {
  const c = defaultConfig()
  assert.equal(c.version, 1)
  assert.ok('tops' in c.selection)
})

test('validateConfig drops unknown variant ids to null', () => {
  const c = validateConfig({ version: 1, eyeColor: null, selection: { tops: 'nope', bottoms: 'bottoms-jean', hair: null, face: null } })
  assert.equal(c?.selection.tops, null)
  assert.equal(c?.selection.bottoms, 'bottoms-jean')
})

test('validateConfig keeps only #rrggbb eye colors', () => {
  assert.equal(validateConfig({ version: 1, selection: {}, eyeColor: 'red' })?.eyeColor, null)
  assert.equal(validateConfig({ version: 1, selection: {}, eyeColor: '#aabbcc' })?.eyeColor, '#aabbcc')
})

test('validateConfig rejects non-objects and wrong version', () => {
  assert.equal(validateConfig(null), null)
  assert.equal(validateConfig({ version: 2, selection: {} }), null)
})
