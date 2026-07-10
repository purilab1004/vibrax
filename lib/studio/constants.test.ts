import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CREDIT_PACKS, GENERATION_COST, creditsForPriceId, packPriceId } from './constants'

test('팩 정의는 스펙 금액/크레딧과 일치한다', () => {
  assert.equal(GENERATION_COST, 10)
  assert.deepEqual(CREDIT_PACKS.map(p => [p.usd, p.credits]), [[5, 100], [20, 450], [50, 1250]])
})

test('creditsForPriceId는 env의 price id를 크레딧으로 매핑한다', () => {
  process.env.NEXT_PUBLIC_PADDLE_PRICE_SMALL = 'pri_test_small'
  assert.equal(packPriceId('small'), 'pri_test_small')
  assert.equal(creditsForPriceId('pri_test_small'), 100)
  assert.equal(creditsForPriceId('pri_unknown'), 0)
  assert.equal(creditsForPriceId(undefined), 0)
})
