import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGeneration, hasGenError, extractTitle, GEN_ERROR_MARKER } from './parse'

test('game 태그 이전 텍스트만 있으면 description만 채운다', () => {
  const p = parseGeneration('점프 게임을 만들고 있어요.')
  assert.equal(p.description, '점프 게임을 만들고 있어요.')
  assert.equal(p.html, null)
  assert.equal(p.generating, false)
})

test('열림 태그만 있으면 generating=true, htmlBytes는 부분 길이', () => {
  const p = parseGeneration('설명입니다.\n<game><!DOCTYPE html><html>')
  assert.equal(p.description, '설명입니다.')
  assert.equal(p.html, null)
  assert.equal(p.generating, true)
  assert.equal(p.htmlBytes, '<!DOCTYPE html><html>'.length)
})

test('닫힘 태그까지 있으면 html을 추출한다', () => {
  const p = parseGeneration('완성!\n<game>\n<!DOCTYPE html><html><body>hi</body></html>\n</game>\n')
  assert.equal(p.description, '완성!')
  assert.equal(p.html, '<!DOCTYPE html><html><body>hi</body></html>')
  assert.equal(p.generating, false)
})

test('에러 마커를 감지하고 파싱에서는 제거한다', () => {
  const text = '설명' + GEN_ERROR_MARKER
  assert.equal(hasGenError(text), true)
  assert.equal(parseGeneration(text).description, '설명')
})

test('extractTitle은 title 태그 내용을 돌려준다', () => {
  assert.equal(extractTitle('<html><head><title>PIXEL JUMP</title></head></html>'), 'PIXEL JUMP')
  assert.equal(extractTitle('<html></html>'), null)
})
