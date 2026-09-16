import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPatches, applyPatches } from './patch'

const base = `<!DOCTYPE html>\n<html>\n<body>\n<script>\nfunction hud(){\n  $('lives').textContent='❤'.repeat(lives);\n}\nlet x=1;\n</script>\n</body>\n</html>`

test('extractPatches: 설명 + 블록 2개', () => {
  const t = `하트를 고양이로 바꿨어요.\n<patch>\n<<<<<<< SEARCH\n  $('lives').textContent='❤'.repeat(lives);\n=======\n  $('lives').textContent='🐱'.repeat(lives);\n>>>>>>> REPLACE\n</patch>\n<patch>\n<<<<<<< SEARCH\nlet x=1;\n=======\nlet x=2;\n>>>>>>> REPLACE\n</patch>`
  const p = extractPatches(t)
  assert.equal(p.hasPatch, true); assert.equal(p.blocks.length, 2); assert.equal(p.description, '하트를 고양이로 바꿨어요.')
  const r = applyPatches(base, p.blocks)
  assert.deepEqual(r.failed, []); assert.ok(r.html.includes("'🐱'.repeat")); assert.ok(r.html.includes('let x=2;'))
})

test('applyPatches: 들여쓰기 차이 허용, 없는 원문은 실패 번호', () => {
  const r = applyPatches(base, [{ search: "$('lives').textContent='❤'.repeat(lives);", replace: 'ok();' }, { search: 'nope()', replace: 'x' }])
  assert.deepEqual(r.failed, [1]); assert.ok(r.html.includes('ok();')); assert.ok(!r.html.includes('❤'))
})

test('extractPatches: 패치 없으면 hasPatch false', () => {
  const p = extractPatches('설명\n<game><html></html></game>')
  assert.equal(p.hasPatch, false); assert.equal(p.blocks.length, 0)
})
