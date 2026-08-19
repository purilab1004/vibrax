import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSafeCond } from './ratelimit'
test('isSafeCond: 허용 식', () => {
  for (const c of ['s.ballX > s.paddleX + 8', 'Math.abs(s.dx) < 3 && s.lives <= 1', 's.phase === 1 ? s.a > 2 : false', '!(s.x>1)', 's.score % 2 == 0']) assert.equal(isSafeCond(c), true, c)
})
test('isSafeCond: 차단 식', () => {
  for (const c of ["s['constructor']", 'alert(1)', 's.x > 1) || parent.postMessage(1,"*") || (1', 'window.x', 'fetch("a")', 's.constructor.constructor("x")()', 's.constructor.constructor(1)()', 's.__proto__.x > 1', 's.x > 1)', '(s.x', 'Math.random() > 0', 's.x; 1', '`a`', '']) assert.equal(isSafeCond(c), false, c)
})
