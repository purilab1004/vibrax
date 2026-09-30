import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeEpisodeHtml, realAdditions, mergeCovered, parseJson, digestGame } from './core'

test('composeEpisodeHtml: [[CUT:n]] 자리에 컷을 넣고, 자리 없는 컷은 문단 사이에 끼운다', () => {
  const html = '<p>a</p><p>[[CUT:1]]</p><p>b</p><p>c</p>'
  const out = composeEpisodeHtml(html, [{ url: 'https://x/1.jpg', caption: '마을' }, { url: 'https://x/2.jpg' }])
  assert.match(out, /<figure class="story-cut"><img src="https:\/\/x\/1.jpg" alt="마을" loading="lazy" \/><figcaption>마을<\/figcaption><\/figure><p>b<\/p>/)
  assert.match(out, /2\.jpg/)
  assert.equal((out.match(/story-cut/g) ?? []).length, 2)
  assert.doesNotMatch(out, /\[\[CUT/)
})

test('composeEpisodeHtml: 없는 번호·중복 마커는 지운다', () => {
  const out = composeEpisodeHtml('<p>[[CUT:3]]</p><p>x</p>[[CUT:1]][[CUT:1]]', [{ url: 'u' }])
  assert.equal((out.match(/story-cut/g) ?? []).length, 1)
  assert.doesNotMatch(out, /\[\[CUT/)
})

test('realAdditions: 이미 나온 이름(공백 차이 포함)과 아이템 등은 새 회차 거리가 아니다', () => {
  const covered = ['슬라임 들판', '오크 왕']
  const r = realAdditions(covered, [
    { kind: 'map', name: '슬라임들판' }, { kind: 'boss', name: '오크왕' },
    { kind: 'map', name: '용의 둥지' }, { kind: 'character', name: '촌장' }, { kind: 'monster', name: '' },
  ])
  assert.deepEqual(r.map(e => e.name), ['용의 둥지'])
})

test('mergeCovered: 순서를 지키며 중복 없이 합친다', () => {
  assert.deepEqual(mergeCovered(['a b'], [{ kind: 'map', name: 'ab' }, { kind: 'map', name: 'c' }]), ['a b', 'c'])
})

test('parseJson: 코드펜스·앞뒤 설명을 무시한다', () => {
  assert.deepEqual(parseJson('설명\n```json\n{"a":1}\n```'), { a: 1 })
  assert.equal(parseJson('없음'), null)
})

test('digestGame: base64·style 을 버리고 이름 줄만 남긴다', () => {
  const html = `<style>.a{}</style>\n<img src="data:image/png;base64,AAAA">\nconst MAPS = [\n  { id: 0, name: '새싹 마을' },\nfoo();\n`
  const d = digestGame(html)
  assert.match(d, /새싹 마을/)
  assert.doesNotMatch(d, /AAAA|foo\(\)/)
})
