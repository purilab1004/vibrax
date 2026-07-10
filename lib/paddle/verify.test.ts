import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { parsePaddleSignature, verifyPaddleSignature } from './verify'

const SECRET = 'whsec_test'
const sign = (ts: string, body: string) =>
  createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')

test('올바른 서명은 통과한다', () => {
  const body = '{"event_type":"transaction.completed"}'
  const header = `ts=1700000000;h1=${sign('1700000000', body)}`
  assert.equal(verifyPaddleSignature(body, header, SECRET), true)
})

test('본문이 변조되면 실패한다', () => {
  const header = `ts=1700000000;h1=${sign('1700000000', '{"a":1}')}`
  assert.equal(verifyPaddleSignature('{"a":2}', header, SECRET), false)
})

test('시크릿이 다르면 실패한다', () => {
  const body = '{}'
  const header = `ts=1;h1=${sign('1', body)}`
  assert.equal(verifyPaddleSignature(body, header, 'other'), false)
})

test('형식이 잘못된 헤더/빈 시크릿은 실패한다', () => {
  assert.equal(parsePaddleSignature('garbage'), null)
  assert.equal(verifyPaddleSignature('{}', 'garbage', SECRET), false)
  assert.equal(verifyPaddleSignature('{}', 'ts=1;h1=ab', ''), false)
})
