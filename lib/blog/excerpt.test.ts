import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripHtml, makeExcerpt } from './excerpt'

test('stripHtml: 태그 제거 + 공백 정리', () => {
  assert.equal(stripHtml('<h2>제목</h2><p>본문 <b>강조</b></p>'), '제목 본문 강조')
})

test('stripHtml: 엔티티 디코드', () => {
  assert.equal(stripHtml('<p>A &amp; B &lt;C&gt;&nbsp;D</p>'), 'A & B <C> D')
})

test('makeExcerpt: 짧으면 그대로', () => {
  assert.equal(makeExcerpt('<p>짧은 글</p>'), '짧은 글')
})

test('makeExcerpt: 길면 max에서 자르고 말줄임', () => {
  const html = `<p>${'가'.repeat(300)}</p>`
  const out = makeExcerpt(html, 160)
  assert.equal(out.length, 161) // 160 + '…'
  assert.ok(out.endsWith('…'))
})
