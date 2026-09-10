import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitWeightsFromChoices } from './imitation'

// 숨은 진짜 가중치로 사람이 골랐다고 가정 → 맞춘 가중치가 그 선택을 재현해야 한다
test('fitWeightsFromChoices: 숨은 가중치의 선택을 복원한다', () => {
  const names = ['lines', 'holes', 'agg', 'bump', 'height']
  const trueW = [80, -22, -1.1, -2.2, -6]
  const rnd = (n: number) => Math.random() * n
  const choices = Array.from({ length: 40 }, () => {
    const cands = Array.from({ length: 30 }, (_, i) => ({ id: String(i), f: [Math.floor(rnd(3)), Math.floor(rnd(6)), rnd(60), rnd(20), rnd(5)] }))
    const scores = cands.map(c => c.f.reduce((a, v, i) => a + v * trueW[i], 0))
    const chosen = cands[scores.indexOf(Math.max(...scores))].id
    return { names, cands, chosen }
  })
  const fit = fitWeightsFromChoices(choices, null)
  assert.ok(fit, 'fit should exist')
  assert.ok(fit!.agree >= 0.8, `agree ${fit!.agree}`)
  assert.ok(fit!.agree >= fit!.baseAgree)
})

test('fitWeightsFromChoices: 표본 10개 미만이면 null', () => {
  assert.equal(fitWeightsFromChoices([], null), null)
})
