import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPatches, applyPatches, validatePatchedHtml } from './patch'

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

test('extractPatches: 구분자가 두 번 들어간 잘못된 블록은 버리고, 같은 SEARCH 의 정정본은 마지막만 쓴다', () => {
  const t = `설명\n<patch>\n<<<<<<< SEARCH\nlet x=1;\n=======\nlet x=1;\nfunction f(){}\n=======\n>>>>>>> REPLACE\n</patch>\n다시 정리:\n<patch>\n<<<<<<< SEARCH\nlet x=1;\n=======\nlet x=1;\nfunction f(){}\n>>>>>>> REPLACE\n</patch>`
  const p = extractPatches(t)
  assert.equal(p.blocks.length, 1); assert.equal(p.blocks[0].replace, 'let x=1;\nfunction f(){}')
  const r = applyPatches(base, p.blocks)
  assert.deepEqual(r.failed, []); assert.equal((r.html.match(/function f\(\)/g) ?? []).length, 1)
  assert.equal(validatePatchedHtml(r.html), null)
})

test('validatePatchedHtml: 구분자 잔해·문법 오류를 잡는다', () => {
  assert.match(validatePatchedHtml(base.replace('let x=1;', 'let x=1;\n=======\n')) ?? '', /markers/)
  assert.match(validatePatchedHtml(base.replace('let x=1;', 'let x=1; let x=2;')) ?? '', /syntax/)
  assert.equal(validatePatchedHtml(base), null)
})

test('REPLACE 가 비어 있는(삭제) 패치도 읽고 적용한다', () => {
  const text = `설명
<patch>
<<<<<<< SEARCH
  const a = 1;
  const dead = 2;
=======
>>>>>>> REPLACE
<<<<<<< SEARCH
  const b = 3;
=======
  const b = 4;
>>>>>>> REPLACE
</patch>`
  const ex = extractPatches(text)
  assert.equal(ex.blocks.length, 2)
  const base = '  const a = 1;\n  const dead = 2;\n  const b = 3;\n'
  const r = applyPatches(base, ex.blocks)
  assert.deepEqual(r.failed, [])
  assert.equal(r.html.includes('dead'), false)
  assert.equal(r.html.includes('const b = 4;'), true)
})
