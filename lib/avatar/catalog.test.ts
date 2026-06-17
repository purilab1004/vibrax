// lib/avatar/catalog.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG, VARIANTS_BY_ID, defaultSelection, BASE_URL } from './catalog.ts'

test('base url points at composer namespace', () => {
  assert.equal(BASE_URL, '/avatars/composer/male_base.vrm')
})

test('every variant url is under /avatars/composer/', () => {
  for (const cat of CATALOG)
    for (const v of cat.variants)
      assert.ok(v.url.startsWith('/avatars/composer/'), `${v.id} -> ${v.url}`)
})

test('VARIANTS_BY_ID resolves a known variant to its category', () => {
  const r = VARIANTS_BY_ID.get('tops-basic')
  assert.equal(r?.categoryId, 'tops')
  assert.equal(r?.kind, 'static')
})

test('defaultSelection picks first variant per category', () => {
  const sel = defaultSelection()
  assert.equal(sel.tops, 'tops-white-shirt')
  assert.equal(sel.hair, 'hair-sample')
  assert.ok('face' in sel && 'bottoms' in sel)
})
