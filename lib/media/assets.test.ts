import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectAssets, stripAssets, extractAssetIds, scoreAssets, toAssetName, type LoadedAsset, type MediaAssetLite } from './assets'

const A = (o: Partial<LoadedAsset>): LoadedAsset => ({ id: 'a1', name: 'hero', kind: 'character', dataUri: 'data:image/png;base64,AAAA', width: 32, height: 32, meta: {}, bytes: 4, ...o })

test('injectAssets → extractAssetIds → stripAssets 왕복', () => {
  const html = '<!doctype html><html><head><title>t</title></head><body></body></html>'
  const out = injectAssets(html, [A({ id: 'a1' }), A({ id: 'b2', name: 'bg', kind: 'background' })])
  assert.ok(out.includes('window.VIBREX_ASSETS='))
  assert.ok(out.includes('window.drawAsset='))
  assert.deepEqual(extractAssetIds(out), ['a1', 'b2'])
  const stripped = stripAssets(out)
  assert.ok(!stripped.includes('base64,AAAA'))
  assert.ok(stripped.includes('vx-assets:a1,b2'))
  // 재주입 시 이전 shim/주석은 사라지고 하나만 남는다
  const again = injectAssets(stripped, [A({ id: 'c3', name: 'coin', kind: 'item' })])
  assert.deepEqual(extractAssetIds(again), ['c3'])
  assert.equal((again.match(/data-vx-assets=/g) ?? []).length, 1)
  assert.ok(!again.includes('vx-assets:a1,b2'))
})

test('injectAssets 빈 목록이면 기존 shim 만 제거', () => {
  const out = injectAssets(injectAssets('<html><head></head></html>', [A({})]), [])
  assert.equal(extractAssetIds(out).length, 0)
})

test('scoreAssets — 장르·태그·이름 매칭, 종류별 상한', () => {
  const L = (o: Partial<MediaAssetLite>): MediaAssetLite => ({ id: Math.random().toString(36).slice(2), kind: 'character', name: 'x', title: 'x', description: null, genres: [], tags: [], url: '', mime: 'image/png', bytes: 100, width: 32, height: 32, meta: {}, ...o })
  const pool = [
    L({ id: 'g', name: 'knight', title: '기사', genres: ['rpg-action'] }),
    L({ id: 't', name: 'wizard', title: '마법사', tags: ['마법'] }),
    L({ id: 'n', name: 'slime', title: '슬라임' }),
    L({ id: 'bg1', name: 'forest', kind: 'background', genres: ['rpg-action'] }),
    L({ id: 'bg2', name: 'cave', kind: 'background', genres: ['rpg-action'] }),
    L({ id: 'bg3', name: 'castle', kind: 'background', genres: ['rpg-action'] }),
    L({ id: '3d', name: 'tree', kind: 'model3d', genres: ['rpg-action'] }),
    L({ id: 'no', name: 'ship', title: '우주선', genres: ['shooter'] }),
  ]
  const picked = scoreAssets(pool, { prompt: '마법을 쓰는 액션 RPG', genreSlugs: ['rpg-action'] })
  const ids = picked.map(p => p.id)
  assert.ok(ids.includes('g') && ids.includes('t'))
  assert.ok(!ids.includes('n') && !ids.includes('no') && !ids.includes('3d'))
  assert.equal(picked.filter(p => p.kind === 'background').length, 2)
})

test('toAssetName 정규화', () => {
  assert.equal(toAssetName('Hero Knight.png'), 'hero_knight')
  assert.equal(toAssetName('기사.png'), 'asset')
  assert.equal(toAssetName('  __a-b__ '), 'a_b')
})
